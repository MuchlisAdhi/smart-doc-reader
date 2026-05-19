/**
 * Database helper utilities for D1
 * Optimized for B2B invoices (mixed ID/EN)
 */

import type { D1Database } from '@cloudflare/workers-types';

export function generateId(): string {
  return crypto.randomUUID();
}

export interface DocumentRow {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_key: string;
  // Core fields
  vendor: string | null;
  vendor_address: string | null;
  buyer: string | null;
  buyer_address: string | null;
  document_date: string | null;
  due_date: string | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  tax_rate: string | null;
  discount: number | null;
  shipping: number | null;
  currency: string | null;
  document_number: string | null;
  document_type: string | null;
  payment_method: string | null;
  payment_terms: string | null;
  notes: string | null;
  // AI metadata
  raw_extraction: string | null;
  confidence_overall: number | null;
  confidence_fields: string | null;
  ai_model: string | null;
  processing_time_ms: number | null;
  // Status
  status: string;
  error_message: string | null;
  is_verified: number;
  created_at: number;
  updated_at: number;
}

export interface DocumentItemRow {
  id: string;
  document_id: string;
  position: number;
  description: string | null;
  sku: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  discount: number | null;
  total: number | null;
  confidence: number | null;
  created_at: number;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: string;
  created_at: number;
  updated_at: number;
}

// --- User Queries ---

export async function getUserByEmail(db: D1Database, email: string): Promise<UserRow | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<UserRow>();
  return result || null;
}

export async function createUser(
  db: D1Database,
  id: string,
  email: string,
  passwordHash: string,
  name: string | null
): Promise<void> {
  await db
    .prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
    .bind(id, email, passwordHash, name || null, 'user')
    .run();
}

// --- Document Queries ---

export async function createDocument(
  db: D1Database,
  doc: Omit<DocumentRow, 'created_at' | 'updated_at'>
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO documents (
        id, user_id, file_name, file_type, file_size, storage_key,
        vendor, vendor_address, buyer, buyer_address,
        document_date, due_date, total, subtotal, tax, tax_rate,
        discount, shipping, currency, document_number, document_type,
        payment_method, payment_terms, notes,
        raw_extraction, confidence_overall, confidence_fields,
        ai_model, processing_time_ms, status, error_message, is_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      doc.id, doc.user_id, doc.file_name, doc.file_type, doc.file_size, doc.storage_key,
      doc.vendor, doc.vendor_address, doc.buyer, doc.buyer_address,
      doc.document_date, doc.due_date, doc.total, doc.subtotal, doc.tax, doc.tax_rate,
      doc.discount, doc.shipping, doc.currency, doc.document_number, doc.document_type,
      doc.payment_method, doc.payment_terms, doc.notes,
      doc.raw_extraction, doc.confidence_overall, doc.confidence_fields,
      doc.ai_model, doc.processing_time_ms, doc.status, doc.error_message, doc.is_verified
    )
    .run();
}

export async function updateDocument(
  db: D1Database,
  id: string,
  fields: Partial<DocumentRow>
): Promise<void> {
  const allowed = [
    'vendor', 'vendor_address', 'buyer', 'buyer_address',
    'document_date', 'due_date', 'total', 'subtotal', 'tax', 'tax_rate',
    'discount', 'shipping', 'currency', 'document_number', 'document_type',
    'payment_method', 'payment_terms', 'notes',
    'raw_extraction', 'confidence_overall', 'confidence_fields',
    'ai_model', 'processing_time_ms', 'status', 'error_message', 'is_verified'
  ];
  
  const updates: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if (key in fields) {
      updates.push(`${key} = ?`);
      values.push((fields as any)[key]);
    }
  }

  if (updates.length === 0) return;

  updates.push('updated_at = unixepoch()');
  values.push(id);

  await db
    .prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function getDocumentById(
  db: D1Database,
  id: string,
  userId: string
): Promise<DocumentRow | null> {
  const result = await db
    .prepare('SELECT * FROM documents WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first<DocumentRow>();
  return result || null;
}

export async function getDocuments(
  db: D1Database,
  userId: string,
  opts: {
    search?: string;
    vendor?: string;
    buyer?: string;
    dateFrom?: string;
    dateTo?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ documents: DocumentRow[]; total: number }> {
  const page = opts.page || 1;
  const limit = opts.limit || 20;
  const offset = (page - 1) * limit;

  let where = 'WHERE user_id = ?';
  const binds: any[] = [userId];

  if (opts.vendor) {
    where += ' AND vendor LIKE ?';
    binds.push(`%${opts.vendor}%`);
  }
  if (opts.buyer) {
    where += ' AND buyer LIKE ?';
    binds.push(`%${opts.buyer}%`);
  }
  if (opts.dateFrom) {
    where += ' AND document_date >= ?';
    binds.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    where += ' AND document_date <= ?';
    binds.push(opts.dateTo);
  }
  if (opts.status) {
    where += ' AND status = ?';
    binds.push(opts.status);
  }
  if (opts.search) {
    where += ' AND (vendor LIKE ? OR buyer LIKE ? OR file_name LIKE ? OR document_number LIKE ?)';
    const term = `%${opts.search}%`;
    binds.push(term, term, term, term);
  }

  const countResult = await db
    .prepare(`SELECT COUNT(*) as count FROM documents ${where}`)
    .bind(...binds)
    .first<{ count: number }>();
  const total = countResult?.count || 0;

  const fetchBinds = [...binds, limit, offset];
  const results = await db
    .prepare(`SELECT * FROM documents ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .bind(...fetchBinds)
    .all<DocumentRow>();

  return { documents: results.results || [], total };
}

export async function deleteDocument(db: D1Database, id: string, userId: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM documents WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .run();
  return (result.meta?.changes || 0) > 0;
}

// --- Document Items ---

export async function createDocumentItems(
  db: D1Database,
  documentId: string,
  items: Array<{
    description: string | null;
    sku?: string | null;
    quantity: number | null;
    unit?: string | null;
    unit_price: number | null;
    discount?: number | null;
    total: number | null;
    confidence: number | null;
  }>
): Promise<void> {
  if (items.length === 0) return;

  const stmt = db.prepare(
    'INSERT INTO document_items (id, document_id, position, description, sku, quantity, unit, unit_price, discount, total, confidence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  const batch = items.map((item, index) =>
    stmt.bind(
      generateId(), documentId, index,
      item.description, item.sku || null, item.quantity, item.unit || null,
      item.unit_price, item.discount || null, item.total, item.confidence
    )
  );

  await db.batch(batch);
}

export async function getDocumentItems(db: D1Database, documentId: string): Promise<DocumentItemRow[]> {
  const results = await db
    .prepare('SELECT * FROM document_items WHERE document_id = ? ORDER BY position')
    .bind(documentId)
    .all<DocumentItemRow>();
  return results.results || [];
}

export async function deleteDocumentItems(db: D1Database, documentId: string): Promise<void> {
  await db.prepare('DELETE FROM document_items WHERE document_id = ?').bind(documentId).run();
}
