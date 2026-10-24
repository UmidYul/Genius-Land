import { appendFileSync } from 'node:fs';
import type { ChannelKind, ChannelProvider, OutgoingMessage } from './dispatcher';

/**
 * Development stand-ins for real gateways: they print the message to the server log.
 * When DEV_OUTBOX_FILE is set they also append it as one JSON line — end-to-end tests read
 * sign-in codes from there. Real SMS / e-mail / Telegram providers replace them in stage 6.
 */
class ConsoleProvider implements ChannelProvider {
  constructor(readonly channel: ChannelKind) {}

  async send(message: OutgoingMessage): Promise<void> {
    console.warn(`[${this.channel} → ${message.address}] ${message.text}`);
    const outbox = process.env.DEV_OUTBOX_FILE;
    if (outbox) {
      appendFileSync(outbox, `${JSON.stringify({ at: new Date().toISOString(), ...message })}\n`);
    }
  }
}

export const createConsoleSms = (): ChannelProvider => new ConsoleProvider('SMS');
export const createConsoleEmail = (): ChannelProvider => new ConsoleProvider('EMAIL');
