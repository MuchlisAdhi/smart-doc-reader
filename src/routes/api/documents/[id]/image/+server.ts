import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocumentById, getFileByDocumentId } from '$lib/server/db';

/**
 * GET /api/documents/:id/image - Serve the document image from D1 file_storage
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
    const renderedFile = await getFileByDocumentId(platform.env.DB, params.id, 'rendered.png');
    if (renderedFile) {
      const binary = atob(renderedFile.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Response(bytes, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'private, max-age=3600'
        }
      });
    }
  }

  // Serve original file from D1
  const file = await getFileByDocumentId(platform.env.DB, params.id, doc.file_name);
  if (!file) {
    throw error(404, 'File not found in storage');
  }

  const binary = atob(file.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Response(bytes, {
    headers: {
      'Content-Type': doc.file_type,
      'Cache-Control': 'private, max-age=3600'
    }
  });
};
