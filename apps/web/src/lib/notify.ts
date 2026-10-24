import 'server-only';
import { createConsoleEmail, createConsoleSms, createDispatcher } from '@gl/core';

/**
 * Stage 1 sends codes through console stand-ins (server log, and DEV_OUTBOX_FILE if set).
 * Stage 6 swaps in real SMS / e-mail / Telegram providers here — nothing else changes.
 */
export const dispatcher = createDispatcher([createConsoleSms(), createConsoleEmail()]);
