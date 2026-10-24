import { fileURLToPath } from 'node:url';

/** Where the console SMS / e-mail providers write messages during e2e runs. */
export const outboxFile = fileURLToPath(
  new URL('../test-results/e2e-outbox.jsonl', import.meta.url),
);
