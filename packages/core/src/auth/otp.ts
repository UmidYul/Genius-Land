import type { Db, OtpPurpose } from '@gl/db';
import { randomInt, randomUUID } from 'node:crypto';
import { err, ok, type Result } from '../result';
import type { SettingsReader } from '../settings';
import { hmac, safeEqual } from './crypto';
import { authSettings } from './settings';

/** 6 digits, uniformly random (leading zeros allowed). */
export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

const codeHash = (otpId: string, code: string) => hmac(`otp:${otpId}:${code}`);

export interface IssuedCode {
  otpId: string;
  code: string;
  expiresAt: Date;
}

/**
 * Creates a new code and invalidates the user's earlier codes for the same purpose:
 * only the latest code works. Refuses if the previous one was sent too recently.
 */
export async function issueCode(
  db: Db,
  settings: SettingsReader,
  input: { userId: string; purpose: OtpPurpose; target?: string | null },
): Promise<Result<IssuedCode>> {
  const [ttlMinutes, resendSeconds] = await Promise.all([
    settings.get(authSettings.codeTtlMinutes),
    settings.get(authSettings.codeResendSeconds),
  ]);
  const now = Date.now();

  const previous = await db.otpCode.findFirst({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (previous) {
    const wait = Math.ceil((previous.createdAt.getTime() + resendSeconds * 1000 - now) / 1000);
    if (wait > 0) return err('AUTH_CODE_TOO_SOON', { seconds: wait });
  }

  await db.otpCode.updateMany({
    where: { userId: input.userId, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: new Date(now) },
  });

  const otpId = randomUUID();
  const code = generateCode();
  const expiresAt = new Date(now + ttlMinutes * 60_000);
  await db.otpCode.create({
    data: {
      id: otpId,
      userId: input.userId,
      purpose: input.purpose,
      target: input.target ?? null,
      codeHash: codeHash(otpId, code),
      expiresAt,
    },
  });
  return ok({ otpId, code, expiresAt });
}

export interface VerifiedCode {
  otpId: string;
  userId: string;
  target: string | null;
}

/**
 * Checks a code by its challenge id. A code works once, until it expires, and only for a
 * limited number of wrong guesses — after that it is dead and a new one must be requested.
 */
export async function verifyCode(
  db: Db,
  settings: SettingsReader,
  input: { otpId: string; purpose: OtpPurpose; code: string },
): Promise<Result<VerifiedCode>> {
  const maxAttempts = await settings.get(authSettings.codeMaxAttempts);
  const otp = await db.otpCode.findUnique({ where: { id: input.otpId } });
  if (!otp || otp.purpose !== input.purpose) return err('AUTH_CODE_INVALID');
  if (otp.consumedAt || otp.expiresAt.getTime() <= Date.now() || otp.attempts >= maxAttempts) {
    return err('AUTH_CODE_EXPIRED');
  }

  const code = input.code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(code) || !safeEqual(codeHash(otp.id, code), otp.codeHash)) {
    await db.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return err('AUTH_CODE_INVALID');
  }

  // Consume atomically: of two simultaneous correct submissions only one succeeds.
  const { count } = await db.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (count !== 1) return err('AUTH_CODE_EXPIRED');
  return ok({ otpId: otp.id, userId: otp.userId, target: otp.target });
}

/** Removes codes that can no longer be used; run periodically by the worker. */
export async function purgeOldCodes(db: Db, olderThanHours = 24): Promise<number> {
  const { count } = await db.otpCode.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - olderThanHours * 3_600_000) } },
  });
  return count;
}
