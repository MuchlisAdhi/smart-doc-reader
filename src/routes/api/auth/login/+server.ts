import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyPassword, createJWT } from '$lib/server/auth';
import { getUserByEmail } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
  if (!platform?.env) {
    return json({ error: 'Platform not available' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return json({ error: 'Email and password are required' }, { status: 400 });
  }

  const { email, password } = body;

  // Find user
  const user = await getUserByEmail(platform.env.DB, email.toLowerCase().trim());
  if (!user) {
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // Create JWT
  const token = await createJWT(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    platform.env.JWT_SECRET
  );

  // Set HTTP-only cookie
  cookies.set('token', token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60  // 7 days
  });

  return json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    token
  });
};
