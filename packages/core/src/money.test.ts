import { describe, expect, it } from 'vitest';
import {
  NBSP,
  formatSum,
  formatSumNumber,
  parseNonNegativeSum,
  parseSum,
  percentOf,
} from './money';

const MINUS = String.fromCodePoint(0x2212);

describe('parseSum', () => {
  it.each([
    ['3000000', 3_000_000n],
    ['3 000 000', 3_000_000n],
    [`3${NBSP}000${NBSP}000`, 3_000_000n],
    ['3,000,000', 3_000_000n],
    ['  42 ', 42n],
    ['-500', -500n],
    [1200, 1200n],
    [7n, 7n],
  ])('%s → %s', (input, expected) => {
    expect(parseSum(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['', 'abc', '12.5', '1e6', '--5'])('rejects %j', (input) => {
    expect(parseSum(input)).toEqual({ ok: false, error: { code: 'MONEY_INVALID' } });
  });

  it('rejects non-integer and unsafe numbers', () => {
    expect(parseSum(12.5).ok).toBe(false);
    expect(parseSum(Number.MAX_SAFE_INTEGER + 2).ok).toBe(false);
  });

  it('parseNonNegativeSum rejects negatives', () => {
    expect(parseNonNegativeSum('-1')).toEqual({ ok: false, error: { code: 'MONEY_NEGATIVE' } });
    expect(parseNonNegativeSum('0')).toEqual({ ok: true, value: 0n });
  });
});

describe('formatting', () => {
  it('groups digits with non-breaking spaces', () => {
    expect(formatSumNumber(0n)).toBe('0');
    expect(formatSumNumber(999n)).toBe('999');
    expect(formatSumNumber(1000n)).toBe(`1${NBSP}000`);
    expect(formatSumNumber(27_000_000n)).toBe(`27${NBSP}000${NBSP}000`);
    expect(formatSumNumber(-1500n)).toBe(`${MINUS}1${NBSP}500`);
  });

  it('works beyond Number precision', () => {
    expect(formatSumNumber(12_345_678_901_234_567_890n)).toBe(
      ['12', '345', '678', '901', '234', '567', '890'].join(NBSP),
    );
  });

  it('adds the currency word for the locale', () => {
    expect(formatSum(3_000_000n, 'ru')).toBe(`3${NBSP}000${NBSP}000${NBSP}сум`);
    expect(formatSum(3_000_000n, 'uz')).toBe(`3${NBSP}000${NBSP}000${NBSP}soʻm`);
  });
});

describe('percentOf', () => {
  it('computes whole-sum percentages', () => {
    expect(percentOf(3_000_000n, 10)).toBe(300_000n);
    expect(percentOf(3_000_000n, 0)).toBe(0n);
    expect(percentOf(3_000_000n, 100)).toBe(3_000_000n);
  });

  it('rounds half up', () => {
    expect(percentOf(5n, 10)).toBe(1n); // 0.5 → 1
    expect(percentOf(4n, 10)).toBe(0n); // 0.4 → 0
    expect(percentOf(1_000n, 12.5)).toBe(125n);
    expect(percentOf(-5n, 10)).toBe(-1n);
  });
});
