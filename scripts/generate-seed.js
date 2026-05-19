/**
 * Generate seed SQL with properly hashed demo user password.
 * Run: node scripts/generate-seed.js
 * 
 * This uses the same PBKDF2-SHA256 algorithm as the app's auth module.
 */

import { webcrypto } from 'node:crypto';

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const key = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8
  );
  const hashBase64 = Buffer.from(new Uint8Array(key)).toString('base64');
  const saltBase64 = Buffer.from(salt).toString('base64');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltBase64}$${hashBase64}`;
}

async function main() {
  const hash = await hashPassword('demo1234');
  console.log('Password hash for demo1234:');
  console.log(hash);
  console.log('\n--- seed.sql ---');
  console.log(`INSERT OR IGNORE INTO users (id, email, password_hash, name, role)
VALUES (
  'demo-user-001',
  'demo@superbrands.test',
  '${hash}',
  'Demo User',
  'user'
);`);
}

main();
