import { formatDateTime } from '@gl/core/time';
import { z } from 'zod';
import type { Logger } from '../logger';

/**
 * Demonstration job: proves the queue, the scheduler and the time zone utilities work end to
 * end. It has no business effect and will be removed once real jobs (invoices, reminders) exist.
 */
export const DEMO_PING_QUEUE = 'demo.ping';

export const demoPingPayload = z.object({
  source: z.enum(['startup', 'schedule', 'manual']).default('manual'),
});
export type DemoPingPayload = z.infer<typeof demoPingPayload>;

export interface DemoPingResult {
  source: DemoPingPayload['source'];
  /** Processing time in school time, DD.MM.YYYY HH:mm. */
  processedAt: string;
}

export function handleDemoPing(
  data: unknown,
  logger: Logger,
  now: () => Date = () => new Date(),
): DemoPingResult {
  const payload = demoPingPayload.parse(data ?? {});
  const result = { source: payload.source, processedAt: formatDateTime(now()) };
  logger.info('demo.ping processed', { ...result });
  return result;
}
