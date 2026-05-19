import { verifyJWT } from '$lib/server/auth';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Skip auth for public routes
  const publicPaths = ['/api/auth/login', '/api/auth/register', '/login', '/register'];
  const isPublic = publicPaths.some((p) => event.url.pathname === p) || 
                   event.url.pathname.startsWith('/api/auth/');

  // Extract token from cookie or Authorization header
  const cookieToken = event.cookies.get('token');
  const headerToken = event.request.headers.get('Authorization')?.replace('Bearer ', '');
  const token = cookieToken || headerToken;

  if (token && event.platform?.env?.JWT_SECRET) {
    const payload = await verifyJWT(token, event.platform.env.JWT_SECRET);
    if (payload) {
      event.locals.user = {
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role
      };
    }
  }

  // Protect non-public routes
  if (!isPublic && !event.locals.user) {
    // API routes return 401
    if (event.url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    // Page routes redirect to login
    if (!event.url.pathname.startsWith('/login') && !event.url.pathname.startsWith('/register')) {
      return new Response(null, {
        status: 303,
        headers: { Location: '/login' }
      });
    }
  }

  const response = await resolve(event);
  return response;
};
