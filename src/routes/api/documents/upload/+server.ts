import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDocument, createDocumentItems, updateDocument, generateId } from '$lib/server/db';
import { extractDocument } from '$lib/server/groq';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/documents/upload - Upload and process document(s)
 * 
 * For PDFs: client must render to image first and send as `pdf_images[]` (base64 PNG)
 * alongside the original PDF file. If pdf_images is provided, we use those for OCR.
 */
export const POST: RequestHandler = async ({ request, locals, platform }) => {
  if (!locals.user || !platform?.env) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  // PDF rendered images sent as base64 strings (one per PDF file, in order)
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
      return json({ error: `File ${file.name} exceeds 10MB limit` }, { status: 400 });
    }
  }

  const results = [];
  let pdfImageIndex = 0;

  for (const file of files) {
    const docId = generateId();
    const storageKey = `documents/${locals.user.id}/${docId}/${file.name}`;

    try {
      // 1. Read file content
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // 2. Upload original to R2
      await platform.env.BUCKET.put(storageKey, bytes, {
        httpMetadata: { contentType: file.type },
        customMetadata: { userId: locals.user.id, documentId: docId }
      });

      // 3. Create document record (processing)
      await createDocument(platform.env.DB, {
        id: docId,
        user_id: locals.user.id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_key: storageKey,
        vendor: null,
        document_date: null,
        total: null,
        subtotal: null,
        tax: null,
        currency: null,
        document_number: null,
        document_type: null,
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

      // 4. Determine image data for Groq Vision
      let imageBase64: string;
      let mimeType: string;

      if (file.type === 'application/pdf') {
        // PDF: use client-rendered image
        const pdfImageData = pdfImages[pdfImageIndex];
        pdfImageIndex++;

        if (!pdfImageData) {
          throw new Error('PDF image rendering data not provided. Please try again.');
        }

        // pdfImageData is base64 PNG (without data:image/png;base64, prefix)
        imageBase64 = pdfImageData;
        mimeType = 'image/png';

        // Also store the rendered image in R2 for preview
        const imageBytes = base64ToBuffer(imageBase64);
        const imageKey = `documents/${locals.user.id}/${docId}/rendered.png`;
        await platform.env.BUCKET.put(imageKey, imageBytes, {
          httpMetadata: { contentType: 'image/png' },
          customMetadata: { userId: locals.user.id, documentId: docId, type: 'rendered' }
        });
      } else {
        // Image: send directly
        imageBase64 = bufferToBase64(bytes);
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
        document_date: extraction.data.document_date,
        total: extraction.data.total,
        subtotal: extraction.data.subtotal,
        tax: extraction.data.tax,
        currency: extraction.data.currency,
        document_number: extraction.data.document_number,
        document_type: extraction.data.document_type,
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
            quantity: item.quantity,
            unit_price: item.unit_price,
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

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
