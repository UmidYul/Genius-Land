import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Server secret for HMACs (one-time codes, API access tokens). Set AUTH_SECRET in .env —
 * at least 32 characters; rotating it invalidates outstanding codes and access tokens.
 */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be set to a random string of at least 32 characters.');
  }
  return secret;
}

export const hmac = (value: string) =>
  createHmac('sha256', authSecret()).update(value).digest('hex');

/** High-entropy random token for cookies and refresh tokens (256 bits, base64url). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Tokens are stored only as SHA-256: a database leak does not leak usable sessions. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
