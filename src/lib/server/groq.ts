/**
 * Groq Vision AI - Document extraction via LLM
 * Uses Llama Vision model for OCR + structured data extraction in a single call.
 * Advantages: fast inference (~1-3s), free tier, native vision, JSON mode.
 */

export interface ExtractedDocument {
  vendor: string | null;
  document_date: string | null;       // ISO YYYY-MM-DD
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  currency: string | null;            // ISO 4217 e.g. IDR, USD, SGD
  document_number: string | null;
  document_type: 'receipt' | 'invoice' | 'other';
  items: ExtractedItem[];
  notes: string | null;
  confidence: ConfidenceFields;
}

export interface ExtractedItem {
  description: string;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  confidence: number;  // 0..1
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

const EXTRACTION_PROMPT = `You are a precise financial document OCR system. Analyze the uploaded receipt/invoice image and extract structured data.

INSTRUCTIONS:
1. Extract all visible text and financial data from the document.
2. For each field, provide a confidence score from 0.0 to 1.0:
   - 1.0 = clearly legible, very confident
   - 0.7-0.9 = partially legible, somewhat confident
   - 0.3-0.6 = blurry/unclear, low confidence (guess)
   - 0.0-0.2 = not found or unreadable
3. Dates must be in ISO format YYYY-MM-DD.
4. Amounts must be numeric (no currency symbols).
5. Currency should be ISO 4217 code (e.g., IDR, USD, SGD, EUR).
6. If the image is not a receipt/invoice, set document_type to "other" and set overall confidence very low.
7. For blurry/dark/tilted documents, do your best and reflect uncertainty in confidence scores.

RESPOND ONLY WITH VALID JSON matching this exact schema:
{
  "vendor": "string or null",
  "document_date": "YYYY-MM-DD or null",
  "total": number or null,
  "subtotal": number or null,
  "tax": number or null,
  "currency": "ISO 4217 code or null",
  "document_number": "string or null",
  "document_type": "receipt | invoice | other",
  "items": [
    {
      "description": "item name",
      "quantity": number or null,
      "unit_price": number or null,
      "total": number or null,
      "confidence": 0.0-1.0
    }
  ],
  "notes": "any additional text/notes visible or null",
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

  const parsed = JSON.parse(content) as ExtractedDocument;
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

  return {
    data: parsed,
    model: result.model || 'meta-llama/llama-4-scout-17b-16e-instruct',
    processingTimeMs
  };
}
