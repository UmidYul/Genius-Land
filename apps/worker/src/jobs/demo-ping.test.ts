import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../logger';
import { handleDemoPing } from './demo-ping';

const logger: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

describe('demo.ping', () => {
  it('reports the processing time in school time', () => {
    const result = handleDemoPing(
      { source: 'startup' },
      logger,
      () => new Date('2026-10-24T03:00:00Z'),
    );
    expect(result).toEqual({ source: 'startup', processedAt: '24.10.2026 08:00' });
    expect(logger.info).toHaveBeenCalledWith('demo.ping processed', result);
  });

  it('defaults the source and rejects unknown payloads', () => {
    expect(handleDemoPing(null, logger).source).toBe('manual');
    expect(() => handleDemoPing({ source: 'nope' }, logger)).toThrow();
  });
});
