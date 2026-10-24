import 'server-only';
import type { CodeSent } from '@gl/core';
import { cookies } from 'next/headers';
import { CHALLENGE_COOKIE, cookieOptions } from './auth';

const CHALLENGE_MAX_AGE = 15 * 60;

/**
 * The open sign-in or reset step lives in an httpOnly cookie between the two pages: the code id
 * and the masked destinations ("sent to +998 90 *** ** 67"). The code itself is never stored.
 */
export interface Challenge {
  id: string;
  purpose: 'login' | 'reset';
  sentTo: CodeSent['sentTo'];
}

export async function saveChallenge(challenge: Challenge) {
  (await cookies()).set(
    CHALLENGE_COOKIE,
    JSON.stringify(challenge),
    cookieOptions(CHALLENGE_MAX_AGE),
  );
}

export async function readChallenge(purpose: Challenge['purpose']): Promise<Challenge | null> {
  const raw = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const challenge = JSON.parse(raw) as Challenge;
    return challenge.purpose === purpose && typeof challenge.id === 'string' ? challenge : null;
  } catch {
    return null;
  }
}
