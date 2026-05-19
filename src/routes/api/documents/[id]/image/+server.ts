import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocumentById } from '$lib/server/db';

/**
 * GET /api/documents/:id/image - Serve the document image from R2
 * For PDFs, serves the rendered PNG version if available.
 */
export const GET: RequestHandler = async ({ params, locals, platform }) => {
  if (!locals.user || !platform?.env) {
    throw error(401, 'Unauthorized');
  }

  const doc = await getDocumentById(platform.env.DB, params.id, locals.user.id);
  if (!doc) {
    throw error(404, 'Document not found');
  }

  // For PDFs, try to serve the rendered PNG first
  if (doc.file_type === 'application/pdf') {
    const renderedKey = doc.storage_key.replace(/[^/]+$/, 'rendered.png');
    const renderedObject = await platform.env.BUCKET.get(renderedKey);
    if (renderedObject) {
      const headers = new Headers();
      headers.set('Content-Type', 'image/png');
      headers.set('Cache-Control', 'private, max-age=3600');
      return new Response(renderedObject.body as ReadableStream, { headers });
    }
  }

  // Serve original file
  const object = await platform.env.BUCKET.get(doc.storage_key);
  if (!object) {
    throw error(404, 'File not found in storage');
  }

  const headers = new Headers();
  headers.set('Content-Type', doc.file_type);
  headers.set('Cache-Control', 'private, max-age=3600');
  
  return new Response(object.body as ReadableStream, { headers });
};
