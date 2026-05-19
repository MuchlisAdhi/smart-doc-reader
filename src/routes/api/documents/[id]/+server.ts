import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocumentById, getDocumentItems, updateDocument, deleteDocument, deleteDocumentItems, createDocumentItems } from '$lib/server/db';

/**
 * GET /api/documents/:id - Get single document with items
 */
export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.user || !platform?.env) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doc = await getDocumentById(platform.env.DB, params.id, locals.user.id);
  if (!doc) {
    return json({ error: 'Document not found' }, { status: 404 });
  }

  const items = await getDocumentItems(platform.env.DB, params.id);

  return json({
    document: doc,
    items,
    confidence_fields: doc.confidence_fields ? JSON.parse(doc.confidence_fields) : null
  });
};

/**
 * PUT /api/documents/:id - Update document (user review/correction)
 */
export const PUT: RequestHandler = async ({ params, request, locals, platform }) => {
  if (!locals.user || !platform?.env) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doc = await getDocumentById(platform.env.DB, params.id, locals.user.id);
  if (!doc) {
    return json({ error: 'Document not found' }, { status: 404 });
  }

  const body = await request.json();

  // Update main fields
  await updateDocument(platform.env.DB, params.id, {
    vendor: body.vendor ?? doc.vendor,
    document_date: body.document_date ?? doc.document_date,
    total: body.total !== undefined ? parseFloat(body.total) || null : doc.total,
    subtotal: body.subtotal !== undefined ? parseFloat(body.subtotal) || null : doc.subtotal,
    tax: body.tax !== undefined ? parseFloat(body.tax) || null : doc.tax,
    currency: body.currency ?? doc.currency,
    document_number: body.document_number ?? doc.document_number,
    document_type: body.document_type ?? doc.document_type,
    notes: body.notes ?? doc.notes,
    is_verified: body.is_verified !== undefined ? (body.is_verified ? 1 : 0) : doc.is_verified,
    status: body.is_verified ? 'reviewed' : doc.status
  });

  // Update items if provided
  if (body.items && Array.isArray(body.items)) {
    await deleteDocumentItems(platform.env.DB, params.id);
    if (body.items.length > 0) {
      await createDocumentItems(
        platform.env.DB,
        params.id,
        body.items.map((item: any) => ({
          description: item.description || null,
          quantity: item.quantity !== undefined ? parseFloat(item.quantity) || null : null,
          unit_price: item.unit_price !== undefined ? parseFloat(item.unit_price) || null : null,
          total: item.total !== undefined ? parseFloat(item.total) || null : null,
          confidence: item.confidence ?? 1.0
        }))
      );
    }
  }

  return json({ ok: true });
};

/**
 * DELETE /api/documents/:id - Delete document
 */
export const DELETE: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.user || !platform?.env) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doc = await getDocumentById(platform.env.DB, params.id, locals.user.id);
  if (!doc) {
    return json({ error: 'Document not found' }, { status: 404 });
  }

  // Delete from R2
  try {
    await platform.env.BUCKET.delete(doc.storage_key);
  } catch { /* ignore R2 delete error */ }

  // Delete from DB (cascades to items)
  await deleteDocument(platform.env.DB, params.id, locals.user.id);

  return json({ ok: true });
};
