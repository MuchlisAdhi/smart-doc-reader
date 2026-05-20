import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDocument, createDocumentItems, updateDocument, generateId, storeFile } from '$lib/server/db';
import { extractDocument } from '$lib/server/groq';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB (lower limit for D1 storage)

/**
 * POST /api/documents/upload - Upload and process document(s)
 * 
 * Files stored in D1 (file_storage table) as base64.
 * For PDFs: client renders to image first and sends as `pdf_images[]`.
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user || !platform?.env) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  const pdfImages = formData.getAll('pdf_images') as string[];

  if (!files || files.length === 0) {
    return json({ error: 'No files provided' }, { status: 400 });
  }

  // Validate files
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return json({ error: `Unsupported file type: ${file.type}. Allowed: JPG, PNG, WebP, PDF` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return json({ error: `File ${file.name} exceeds 5MB limit` }, { status: 400 });
    }
  }

  const results = [];
  let pdfImageIndex = 0;

  for (const file of files) {
    const docId = generateId();
    const storageKey = `${locals.user.id}/${docId}/${file.name}`;

    try {
      // 1. Read file content
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const fileBase64 = bufferToBase64(bytes);

      // 2. Create document record FIRST (file_storage has FK to documents)
      await createDocument(platform.env.DB, {
        id: docId,
        user_id: locals.user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_key: storageKey,
        vendor: null,
        vendor_address: null,
        buyer: null,
        buyer_address: null,
        document_date: null,
        due_date: null,
        total: null,
        subtotal: null,
        tax: null,
        tax_rate: null,
        discount: null,
        shipping: null,
        currency: null,
        document_number: null,
        document_type: null,
        payment_method: null,
        payment_terms: null,
        notes: null,
        raw_extraction: null,
        confidence_overall: null,
        confidence_fields: null,
        ai_model: null,
        processing_time_ms: null,
        status: 'processing',
        error_message: null,
        is_verified: 0
      });

      // 3. Store file in D1 (file_storage table - after document exists)
      await storeFile(platform.env.DB, {
        id: generateId(),
        document_id: docId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        data: fileBase64
      });

      // 4. Determine image data for Groq Vision
      let imageBase64: string;
      let mimeType: string;

      if (file.type === 'application/pdf') {
        const pdfImageData = pdfImages[pdfImageIndex];
        pdfImageIndex++;

        if (!pdfImageData) {
          throw new Error('PDF image rendering data not provided. Please try again.');
        }

        imageBase64 = pdfImageData;
        mimeType = 'image/png';

        // Store the rendered image in D1 for preview
        await storeFile(platform.env.DB, {
          id: generateId(),
          document_id: docId,
          file_name: 'rendered.png',
          file_type: 'image/png',
          file_size: Math.ceil(pdfImageData.length * 0.75), // approx decoded size
          data: pdfImageData
        });
      } else {
        imageBase64 = fileBase64;
        mimeType = file.type;
      }

      // 5. Extract via Groq Vision AI
      const extraction = await extractDocument(imageBase64, mimeType, platform.env.GROQ_API_KEY);

      // 6. Build notes (include quality issues if any)
      let finalNotes = extraction.data.notes || '';
      if (extraction.data.quality_issues && extraction.data.quality_issues.length > 0) {
        const qualityNote = `[Quality issues detected: ${extraction.data.quality_issues.join(', ')}]`;
        finalNotes = finalNotes ? `${qualityNote}\n${finalNotes}` : qualityNote;
      }

      // 7. Update document with extraction results
      await updateDocument(platform.env.DB, docId, {
        vendor: extraction.data.vendor,
        vendor_address: extraction.data.vendor_address,
        buyer: extraction.data.buyer,
        buyer_address: extraction.data.buyer_address,
        document_date: extraction.data.document_date,
        due_date: extraction.data.due_date,
        total: extraction.data.total,
        subtotal: extraction.data.subtotal,
        tax: extraction.data.tax,
        tax_rate: extraction.data.tax_rate,
        discount: extraction.data.discount,
        shipping: extraction.data.shipping,
        currency: extraction.data.currency,
        document_number: extraction.data.document_number,
        document_type: extraction.data.document_type,
        payment_method: extraction.data.payment_method,
        payment_terms: extraction.data.payment_terms,
        notes: finalNotes || null,
        raw_extraction: JSON.stringify(extraction.data),
        confidence_overall: extraction.data.confidence.overall,
        confidence_fields: JSON.stringify(extraction.data.confidence),
        ai_model: extraction.model,
        processing_time_ms: extraction.processingTimeMs,
        status: 'completed'
      });

      // 8. Save line items
      if (extraction.data.items && extraction.data.items.length > 0) {
        await createDocumentItems(
          platform.env.DB,
          docId,
          extraction.data.items.map((item) => ({
            description: item.description,
            sku: item.sku,
            quantity: item.quantity,
            unit: item.unit,
            unit_price: item.unit_price,
            discount: item.discount,
            total: item.total,
            confidence: item.confidence
          }))
        );
      }

      results.push({
        id: docId,
        file_name: file.name,
        status: 'completed',
        confidence: extraction.data.confidence.overall
      });
    } catch (err: any) {
      // Mark document as failed
      try {
        await updateDocument(platform.env.DB, docId, {
          status: 'failed',
          error_message: err.message || 'Unknown error during processing'
        });
      } catch { /* ignore db error on failure path */ }

      results.push({
        id: docId,
        file_name: file.name,
        status: 'failed',
        error: err.message || 'Processing failed'
      });
    }
  }

  return json({ results }, { status: 201 });
};

function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}
