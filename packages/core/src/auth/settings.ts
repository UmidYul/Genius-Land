import { z } from 'zod';
import { defineSetting } from '../settings';

const positiveInt = (max: number) => z.number().int().min(1).max(max);

/** Sign-in rules. Numbers are settings so they change without a release (CLAUDE.md). */
export const authSettings = {
  maxFailedAttempts: defineSetting({
    key: 'auth.maxFailedAttempts',
    schema: positiveInt(20),
    defaultValue: 5,
    scope: 'global',
  }),
  lockMinutes: defineSetting({
    key: 'auth.lockMinutes',
    schema: positiveInt(24 * 60),
    defaultValue: 15,
    scope: 'global',
  }),
  codeTtlMinutes: defineSetting({
    key: 'auth.codeTtlMinutes',
    schema: positiveInt(60),
    defaultValue: 10,
    scope: 'global',
  }),
  codeMaxAttempts: defineSetting({
    key: 'auth.codeMaxAttempts',
    schema: positiveInt(20),
    defaultValue: 5,
    scope: 'global',
  }),
  codeResendSeconds: defineSetting({
    key: 'auth.codeResendSeconds',
    schema: positiveInt(600),
    defaultValue: 60,
    scope: 'global',
  }),
  sessionTtlDays: defineSetting({
    key: 'auth.sessionTtlDays',
    schema: positiveInt(365),
    defaultValue: 30,
    scope: 'global',
  }),
  loginAttemptsPerIpPerMinute: defineSetting({
    key: 'auth.rateLimit.loginPerIpPerMinute',
    schema: positiveInt(1000),
    defaultValue: 20,
    scope: 'global',
  }),
  codesPerUserPerHour: defineSetting({
    key: 'auth.rateLimit.codesPerUserPerHour',
    schema: positiveInt(100),
    defaultValue: 6,
    scope: 'global',
  }),
  codesPerIpPerHour: defineSetting({
    key: 'auth.rateLimit.codesPerIpPerHour',
    schema: positiveInt(1000),
    defaultValue: 30,
    scope: 'global',
  }),
} as const;
