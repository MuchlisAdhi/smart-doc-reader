/**
 * Groq Vision AI - Document extraction via LLM
 * Uses Llama Vision model for OCR + structured data extraction in a single call.
 * Advantages: fast inference (~1-3s), free tier, native vision, JSON mode.
 * 
 * Enhanced for degraded documents: blur, dark, tilted, censored, handwritten.
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
  quality_issues: string[];           // detected image quality problems
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

const EXTRACTION_PROMPT = `You are an expert financial document OCR system designed to handle even poor-quality documents. Analyze the uploaded image and extract structured data.

DOCUMENT QUALITY HANDLING:
- The document may be blurry, dark, tilted, partially censored/redacted, or low resolution.
- Some text may be handwritten, stamped, or overlaid on printed text.
- Parts of the document may be intentionally blacked out or obscured for privacy.
- The document may be a photo taken at an angle, not a flat scan.
- Do your BEST to read what is visible and clearly indicate uncertainty.

INSTRUCTIONS:
1. First, assess image quality. Report any issues in the "quality_issues" array.
   Possible issues: "blurry", "dark", "tilted", "low_resolution", "partially_censored", "handwritten_text", "noise", "overexposed", "skewed", "crumpled"
2. Extract all visible text and financial data from the document.
3. For each field, provide a STRICT confidence score from 0.0 to 1.0:
   - 0.9-1.0 = clearly legible, unambiguous, very confident
   - 0.7-0.8 = mostly legible, minor uncertainty
   - 0.4-0.6 = partially legible, significant uncertainty (educated guess)
   - 0.1-0.3 = barely visible, very uncertain (wild guess from context)
   - 0.0 = completely unreadable or not present
4. Dates must be in ISO format YYYY-MM-DD. If year is 2-digit (e.g. "14/03/26"), infer full year from context.
5. Amounts must be numeric (no currency symbols). Use dot as decimal separator.
6. Currency should be ISO 4217 code (e.g., IDR, USD, SGD, EUR). Infer from context (location, currency symbol) if not explicit.
7. If the image is NOT a receipt/invoice/financial document, set document_type to "other" and overall confidence to 0.1.
8. For censored/redacted fields, set their value to null and confidence to 0.0.
9. If handwritten text is present, attempt to read it and note in "notes" field.
10. For tilted/rotated documents, mentally rotate and read normally.
11. IMPORTANT: When a field could have multiple interpretations (e.g., a blurred digit could be 5 or 6), pick the most likely value but lower the confidence.

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
      "description": "item name/description",
      "quantity": number or null,
      "unit_price": number or null,
      "total": number or null,
      "confidence": 0.0-1.0
    }
  ],
  "notes": "handwritten text, stamps, annotations, or other observations. null if none.",
  "quality_issues": ["array of detected quality problems, empty if image is clean"],
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
    // If JSON parsing fails, try to extract JSON from the response
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

  return {
    data: parsed,
    model: result.model || 'meta-llama/llama-4-scout-17b-16e-instruct',
    processingTimeMs
  };
}
