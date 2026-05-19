import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDocuments } from '$lib/server/db';

/**
 * GET /api/documents - List documents with filters
 */
export const GET: RequestHandler = async ({ locals, platform, url }) => {
  if (!locals.user || !platform?.env) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const search = url.searchParams.get('search') || undefined;
  const vendor = url.searchParams.get('vendor') || undefined;
  const dateFrom = url.searchParams.get('dateFrom') || undefined;
  const dateTo = url.searchParams.get('dateTo') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);

  const { documents, total } = await getDocuments(platform.env.DB, locals.user.id, {
    search,
    vendor,
    dateFrom,
    dateTo,
    status,
    page,
    limit
  });

  return json({
    documents,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
};
