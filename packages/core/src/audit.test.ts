import { describe, expect, it } from 'vitest';
import { toAuditJson } from './audit';

describe('toAuditJson', () => {
  it('serialises money, dates and nested values', () => {
    expect(
      toAuditJson({
        amount: 3_000_000n,
        at: new Date('2026-10-24T05:00:00Z'),
        lines: [{ sum: 1n }, null],
        skipped: undefined,
        flag: true,
      }),
    ).toEqual({
      amount: '3000000',
      at: '2026-10-24T05:00:00.000Z',
      lines: [{ sum: '1' }, null],
      flag: true,
    });
  });
});
