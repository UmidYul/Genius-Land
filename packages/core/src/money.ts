import { translate, type Locale } from '@gl/i18n';
import { err, ok, type Result } from './result';

/**
 * Money is always a whole number of sum (UZS) stored as BigInt. No floats, no tiyin:
 * tuition, payments and debts are settled in whole sum.
 */
export type Sum = bigint;

const DIGITS = /^-?\d+$/;
/** Non-breaking space: a sum never wraps between digit groups. */
export const NBSP = String.fromCodePoint(0x00a0);
const NARROW_NBSP = String.fromCodePoint(0x202f);
/** Typographic minus sign for negative amounts. */
const MINUS = String.fromCodePoint(0x2212);
const GROUP_SEPARATORS = new RegExp(String.raw`[\s,${NBSP}${NARROW_NBSP}]`, 'g');

/**
 * Parses user or API input into sum. Accepts digits with spaces, non-breaking spaces,
 * thin spaces or commas as group separators ("3 000 000", "3,000,000").
 * Fractions are rejected — amounts are whole sum.
 */
export function parseSum(input: string | number | bigint): Result<Sum> {
  if (typeof input === 'bigint') return ok(input);
  if (typeof input === 'number') {
    return Number.isSafeInteger(input) ? ok(BigInt(input)) : err('MONEY_INVALID');
  }
  const cleaned = input.trim().replace(GROUP_SEPARATORS, '');
  if (!DIGITS.test(cleaned)) return err('MONEY_INVALID');
  return ok(BigInt(cleaned));
}

/** Same as {@link parseSum}, but negative amounts are an error. */
export function parseNonNegativeSum(input: string | number | bigint): Result<Sum> {
  const parsed = parseSum(input);
  if (!parsed.ok) return parsed;
  return parsed.value < 0n ? err('MONEY_NEGATIVE') : parsed;
}

/** Groups digits by three with a non-breaking space: 3000000n → "3 000 000". */
export function formatSumNumber(amount: Sum): string {
  const negative = amount < 0n;
  const digits = (negative ? -amount : amount).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return negative ? `${MINUS}${grouped}` : grouped;
}

/** Amount with the currency word of the locale: "3 000 000 soʻm" / "3 000 000 сум". */
export function formatSum(amount: Sum, locale: Locale): string {
  return `${formatSumNumber(amount)}${NBSP}${translate(locale, 'common.currency.sum')}`;
}

/**
 * Percentage of an amount, rounded half up to whole sum.
 * `percent` may have up to two decimals (e.g. 12.5); it is applied without floating point.
 */
export function percentOf(amount: Sum, percent: number): Sum {
  const basisPoints = BigInt(Math.round(percent * 100));
  const scaled = amount * basisPoints;
  const divisor = 10_000n;
  const quotient = scaled / divisor;
  const remainder = scaled % divisor;
  const absRemainder = remainder < 0n ? -remainder : remainder;
  if (absRemainder * 2n >= divisor) return scaled < 0n ? quotient - 1n : quotient + 1n;
  return quotient;
}

/** BigInt is not JSON-serialisable; money goes over the wire and into audit records as a string. */
export const sumToJson = (amount: Sum): string => amount.toString();
