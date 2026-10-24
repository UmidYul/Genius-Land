import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url(),
  WORKER_DEMO_CRON: z.string().optional().default(''),
  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type WorkerEnv = z.infer<typeof schema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): WorkerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid worker environment:\n  ${problems.join('\n  ')}`);
  }
  return parsed.data;
}
