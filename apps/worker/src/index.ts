import { SCHOOL_TIME_ZONE } from '@gl/core/time';
import PgBoss from 'pg-boss';
import { readEnv } from './env';
import { DEMO_PING_QUEUE, handleDemoPing, type DemoPingPayload } from './jobs/demo-ping';
import { createLogger } from './logger';

/**
 * Background worker: queues and scheduled jobs on pg-boss (stored in PostgreSQL, schema `pgboss`).
 * Stage 6 adds the Telegram bot to this process.
 */
async function main() {
  const env = readEnv();
  const logger = createLogger(env.LOG_LEVEL);

  const boss = new PgBoss({ connectionString: env.DATABASE_URL, application_name: 'gl-worker' });
  boss.on('error', (error) => logger.error('pg-boss error', { error: String(error) }));

  await boss.start();
  logger.info('worker started');

  await boss.createQueue(DEMO_PING_QUEUE);
  await boss.work<DemoPingPayload>(DEMO_PING_QUEUE, async (jobs) => {
    for (const job of jobs) handleDemoPing(job.data, logger);
  });

  if (env.WORKER_DEMO_CRON) {
    await boss.schedule(
      DEMO_PING_QUEUE,
      env.WORKER_DEMO_CRON,
      { source: 'schedule' },
      {
        tz: SCHOOL_TIME_ZONE,
      },
    );
  } else {
    await boss.unschedule(DEMO_PING_QUEUE);
  }
  await boss.send(DEMO_PING_QUEUE, { source: 'startup' });

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info('worker stopping', { signal });
    try {
      // Stop taking new jobs, let running ones finish, then close the connection pool.
      await boss.stop({ graceful: true, wait: true, timeout: env.WORKER_SHUTDOWN_TIMEOUT_MS });
      logger.info('worker stopped');
      process.exit(0);
    } catch (error) {
      logger.error('worker shutdown failed', { error: String(error) });
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  createLogger().error('worker failed to start', { error: String(error) });
  process.exit(1);
});
