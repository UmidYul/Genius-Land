import { hash, verify } from '@node-rs/argon2';
import { randomInt } from 'node:crypto';
import { err, ok, type Result } from '../result';

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

/** At least 8 characters with at least one letter and one digit (any script). */
export function validatePassword(password: string): Result<string> {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH ||
    !/\p{L}/u.test(password) ||
    !/\p{Nd}/u.test(password)
  ) {
    return err('PASSWORD_WEAK', { min: PASSWORD_MIN_LENGTH });
  }
  return ok(password);
}

// argon2id with the library defaults (m=19 MiB, t=2, p=1 — OWASP baseline).
export const hashPassword = (password: string) => hash(password);

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as a real check when the phone is unknown, so response timing does not
 * reveal which numbers have accounts.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hash('dummy-password-0');
  await verifyPassword(await dummyHash, password);
  return false;
}

// No look-alike characters (0/O, 1/l/I) — the password is read aloud or copied by hand.
const LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/** Temporary password given by the superadmin; the user must change it at first sign-in. */
export function generateTemporaryPassword(length = 10): string {
  const all = LETTERS + DIGITS;
  const chars = [LETTERS[randomInt(LETTERS.length)]!, DIGITS[randomInt(DIGITS.length)]!];
  while (chars.length < length) chars.push(all[randomInt(all.length)]!);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join('');
}
