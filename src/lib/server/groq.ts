/**
 * Groq Vision AI - Document extraction via LLM
 * Uses Llama Vision model for OCR + structured data extraction in a single call.
 * 
 * Optimized for:
 * - B2B invoices (purchase orders, supplier invoices, e-commerce orders)
 * - Mixed Indonesian + English language documents
 * - Single invoice per file
 * - Degraded documents: blur, dark, tilted, censored, handwritten
 */

export interface ExtractedDocument {
  vendor: string | null;
  vendor_address: string | null;        // vendor/seller address
  buyer: string | null;                 // buyer/client name (B2B)
  buyer_address: string | null;         // buyer address
  document_date: string | null;         // ISO YYYY-MM-DD
  due_date: string | null;              // payment due date
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  tax_rate: string | null;              // e.g. "11%", "PPN 11%"
  discount: number | null;              // total discount amount
  shipping: number | null;              // shipping/delivery cost
  currency: string | null;              // ISO 4217 e.g. IDR, USD, SGD
  document_number: string | null;       // invoice/PO/order number
  document_type: 'receipt' | 'invoice' | 'purchase_order' | 'delivery_note' | 'other';
  payment_method: string | null;        // e.g. "Transfer Bank", "SPayLater", "COD"
  payment_terms: string | null;         // e.g. "Net 30", "COD", "Due on receipt"
  items: ExtractedItem[];
  notes: string | null;
  confidence: ConfidenceFields;
  quality_issues: string[];
}

export interface ExtractedItem {
  description: string;
  sku: string | null;                   // SKU/product code if visible
  quantity: number | null;
  unit: string | null;                  // e.g. "pcs", "kg", "unit", "buah"
  unit_price: number | null;
  discount: number | null;              // per-item discount
  total: number | null;
  confidence: number;
}

export interface ConfidenceFields {
  vendor: number;
  document_date: number;
  total: number;
  subtotal: number;
  tax: number;
  currency: number;
  document_number: number;
  items: number;
  overall: number;
}

const EXTRACTION_PROMPT = `Anda adalah sistem OCR dokumen keuangan B2B (invoice/faktur). Analisis gambar dokumen yang diunggah dan ekstrak data terstruktur.

KONTEKS:
- Dokumen bisa dalam Bahasa Indonesia, Inggris, atau campuran keduanya.
- Ini adalah 1 file = 1 invoice/faktur (tidak ada multi-dokumen dalam 1 file).
- Fokus pada invoice B2B: faktur supplier, purchase order, nota pesanan marketplace (Shopee, Tokopedia, dll), invoice jasa, dll.
- Kenali istilah Indonesia: "Subtotal", "Total Pembayaran", "Diskon", "Biaya Kirim/Pengiriman", "PPN/Pajak", "Tanggal", "No. Faktur/Invoice/Pesanan", "Metode Pembayaran", "Jatuh Tempo", "Rp", "Nama Penjual/Toko", "Nama Pembeli".

DOCUMENT QUALITY HANDLING:
- The document may be blurry, dark, tilted, partially censored/redacted, or low resolution.
- Some text may be handwritten, stamped, or overlaid on printed text.
- Parts may be blacked out for privacy. Do your BEST with what's visible.
- Report quality issues detected.

INSTRUCTIONS:
1. Assess image quality. Report issues in "quality_issues" array.
   Possible: "blurry", "dark", "tilted", "low_resolution", "partially_censored", "handwritten_text", "noise", "overexposed", "skewed", "crumpled"
2. Extract ALL visible financial data. For B2B invoices, prioritize:
   - Vendor (seller/penjual/toko)
   - Buyer (pembeli/pelanggan) if visible
   - Invoice/order number (No. Faktur/Pesanan/Invoice/PO)
   - Date (tanggal transaksi/faktur)
   - Due date (jatuh tempo) if present
   - Line items with SKU, qty, unit price, discount, subtotal
   - Subtotal, tax (PPN), discounts (diskon/voucher), shipping (ongkir), total
   - Payment method & terms
3. Confidence scores (STRICT):
   - 0.9-1.0 = clearly legible, unambiguous
   - 0.7-0.8 = mostly legible, minor uncertainty
   - 0.4-0.6 = partially legible, educated guess
   - 0.1-0.3 = barely visible, wild guess
   - 0.0 = unreadable or not present
4. Dates: ISO YYYY-MM-DD. If 2-digit year (e.g. "14/03/26"), infer century from context.
5. Amounts: numeric only, no symbols. Use dot for decimal. Indonesian format "Rp399.000" = 399000 (thousands separator is dot in Indonesia).
6. Currency: ISO 4217. "Rp" = IDR, "$" infer from context (USD/SGD/AUD).
7. If NOT a financial document: document_type = "other", overall confidence = 0.1.
8. Censored/redacted fields: value = null, confidence = 0.0.
9. For marketplace orders (Shopee/Tokopedia/Lazada): vendor = seller/shop name, document_number = order number.
10. IMPORTANT: "Total Pembayaran" in Indonesian invoices is the final amount paid (= total after all discounts/fees). Map this to "total".

RESPOND ONLY WITH VALID JSON:
{
  "vendor": "seller/shop/supplier name or null",
  "vendor_address": "seller address or null",
  "buyer": "buyer/customer name or null",
  "buyer_address": "buyer address or null",
  "document_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "total": number or null (final amount paid),
  "subtotal": number or null (before tax/discount),
  "tax": number or null (PPN/tax amount),
  "tax_rate": "string like '11%' or 'PPN 11%' or null",
  "discount": number or null (total discount, positive number),
  "shipping": number or null (shipping/delivery cost),
  "currency": "IDR/USD/SGD/etc or null",
  "document_number": "invoice/order/PO number or null",
  "document_type": "receipt | invoice | purchase_order | delivery_note | other",
  "payment_method": "payment method string or null",
  "payment_terms": "payment terms string or null",
  "items": [
    {
      "description": "item/product name",
      "sku": "SKU/product code or null",
      "quantity": number or null,
      "unit": "pcs/kg/unit/buah/etc or null",
      "unit_price": number or null,
      "discount": number or null,
      "total": number or null,
      "confidence": 0.0-1.0
    }
  ],
  "notes": "handwritten text, stamps, annotations, additional info, or null",
  "quality_issues": ["detected problems array, empty if clean"],
  "confidence": {
    "vendor": 0.0-1.0,
    "document_date": 0.0-1.0,
    "total": 0.0-1.0,
    "subtotal": 0.0-1.0,
    "tax": 0.0-1.0,
    "currency": 0.0-1.0,
    "document_number": 0.0-1.0,
    "items": 0.0-1.0,
    "overall": 0.0-1.0
  }
}`;

export async function extractDocument(
  imageBase64: string,
  mimeType: string,
  apiKey: string
): Promise<{ data: ExtractedDocument; model: string; processingTimeMs: number }> {
  const startTime = Date.now();

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`
              }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorBody}`);
  }

  const result = await response.json() as any;
  const content = result.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in Groq response');
  }

  let parsed: ExtractedDocument;
  try {
    parsed = JSON.parse(content) as ExtractedDocument;
  } catch (parseErr) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]) as ExtractedDocument;
    } else {
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  const processingTimeMs = Date.now() - startTime;

  // Validate and sanitize confidence scores
  if (parsed.confidence) {
    for (const key of Object.keys(parsed.confidence) as (keyof ConfidenceFields)[]) {
      const val = parsed.confidence[key];
      if (typeof val !== 'number' || val < 0 || val > 1) {
        parsed.confidence[key] = 0;
      }
    }
  } else {
    parsed.confidence = {
      vendor: 0,
      document_date: 0,
      total: 0,
      subtotal: 0,
      tax: 0,
      currency: 0,
      document_number: 0,
      items: 0,
      overall: 0
    };
  }

  // Ensure quality_issues is an array
  if (!Array.isArray(parsed.quality_issues)) {
    parsed.quality_issues = [];
  }

  // Ensure items is an array
  if (!Array.isArray(parsed.items)) {
    parsed.items = [];
  }

  // Sanitize items confidence
  for (const item of parsed.items) {
    if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) {
      item.confidence = 0.5;
    }
  }

  // Default missing fields
  if (!parsed.vendor_address) parsed.vendor_address = null;
  if (!parsed.buyer) parsed.buyer = null;
  if (!parsed.buyer_address) parsed.buyer_address = null;
  if (!parsed.due_date) parsed.due_date = null;
  if (!parsed.tax_rate) parsed.tax_rate = null;
  if (parsed.discount === undefined) parsed.discount = null;
  if (parsed.shipping === undefined) parsed.shipping = null;
  if (!parsed.payment_method) parsed.payment_method = null;
  if (!parsed.payment_terms) parsed.payment_terms = null;

  return {
    data: parsed,
    model: result.model || 'meta-llama/llama-4-scout-17b-16e-instruct',
    processingTimeMs
  };
}
