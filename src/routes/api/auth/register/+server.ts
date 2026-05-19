import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hashPassword, createJWT } from '$lib/server/auth';
import { getUserByEmail, createUser, generateId } from '$lib/server/db';

export const POST: RequestHandler = async ({ request, platform, cookies }) => {
  if (!platform?.env) {
    return json({ error: 'Platform not available' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return json({ error: 'Email and password are required' }, { status: 400 });
  }

  const email = body.email.toLowerCase().trim();
  const password = body.password;
  const name = body.name?.trim() || null;

  // Validate
  if (password.length < 6) {
    return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }
  if (!email.includes('@')) {
    return json({ error: 'Invalid email address' }, { status: 400 });
  }

  // Check existing
  const existing = await getUserByEmail(platform.env.DB, email);
  if (existing) {
    return json({ error: 'Email already registered' }, { status: 409 });
  }

  // Create user
  const id = generateId();
  const passwordHash = await hashPassword(password);
  await createUser(platform.env.DB, id, email, passwordHash, name);

  // Create JWT
  const token = await createJWT(
    { sub: id, email, name, role: 'user' },
    platform.env.JWT_SECRET
  );

  cookies.set('token', token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60
  });

  return json({
    user: { id, email, name, role: 'user' },
    token
  }, { status: 201 });
};
