import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocuments, getDocumentItems } from '$lib/server/db';

/**
 * GET /api/documents/export?format=csv|json
 * Export all (or filtered) documents
 */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
  if (!locals.user || !platform?.env) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const format = url.searchParams.get('format') || 'csv';
  const vendor = url.searchParams.get('vendor') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;

  // Get all matching documents (no pagination for export)
  const { documents } = await getDocuments(platform.env.DB, locals.user.id, {
    vendor,
    dateFrom,
    dateTo,
    limit: 10000
  });

  if (format === 'json') {
    // JSON export with items
    const exportData = [];
    for (const doc of documents) {
      const items = await getDocumentItems(platform.env.DB, doc.id);
      exportData.push({
        id: doc.id,
        file_name: doc.file_name,
        vendor: doc.vendor,
        document_date: doc.document_date,
        total: doc.total,
        subtotal: doc.subtotal,
        tax: doc.tax,
        currency: doc.currency,
        document_number: doc.document_number,
        document_type: doc.document_type,
        notes: doc.notes,
        status: doc.status,
        is_verified: doc.is_verified === 1,
        items: items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total
        })),
        created_at: new Date(doc.created_at * 1000).toISOString()
      });
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="documents_export_${new Date().toISOString().split('T')[0]}.json"`
      }
    });
  }

  // CSV export
  const csvRows: string[] = [];
  csvRows.push(
    'ID,File Name,Vendor,Buyer,Date,Due Date,Total,Subtotal,Tax,Tax Rate,Discount,Shipping,Currency,Document Number,Type,Payment Method,Payment Terms,Notes,Status,Verified,Created At'
  );

  for (const doc of documents) {
    csvRows.push(
      [
        doc.id,
        csvEscape(doc.file_name),
        csvEscape(doc.vendor || ''),
        csvEscape(doc.buyer || ''),
        doc.document_date || '',
        doc.due_date || '',
        doc.total?.toString() || '',
        doc.subtotal?.toString() || '',
        doc.tax?.toString() || '',
        doc.tax_rate || '',
        doc.discount?.toString() || '',
        doc.shipping?.toString() || '',
        doc.currency || '',
        csvEscape(doc.document_number || ''),
        doc.document_type || '',
        csvEscape(doc.payment_method || ''),
        csvEscape(doc.payment_terms || ''),
        csvEscape(doc.notes || ''),
        doc.status,
        doc.is_verified ? 'Yes' : 'No',
        new Date(doc.created_at * 1000).toISOString()
      ].join(',')
    );
  }

  const csv = csvRows.join('\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="documents_export_${new Date().toISOString().split('T')[0]}.csv"`
    }
  });
};

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
