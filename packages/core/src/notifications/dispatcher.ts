import type { Db } from '@gl/db';
import { isLocale, translate, type Locale, type MessageKey, type MessageParams } from '@gl/i18n';

export type ChannelKind = 'SMS' | 'EMAIL' | 'TELEGRAM';

export interface OutgoingMessage {
  channel: ChannelKind;
  /** Phone, e-mail or Telegram chat id. */
  address: string;
  subject?: string;
  text: string;
}

/** One delivery channel (SMS gateway, SMTP, Telegram bot). Real providers arrive in stage 6. */
export interface ChannelProvider {
  readonly channel: ChannelKind;
  send(message: OutgoingMessage): Promise<void>;
}

/** Events with templates `notifications.<event>.text` / `.subject` in both dictionaries. */
export const notificationEvents = ['loginCode', 'passwordResetCode', 'channelVerifyCode'] as const;
export type NotificationEvent = (typeof notificationEvents)[number];

export interface DispatchRequest {
  userId: string;
  event: NotificationEvent;
  params: MessageParams;
  /**
   * Critical messages (sign-in and reset codes) go to EVERY enabled, verified channel,
   * SMS included (Umid's decision). Ordinary ones go to Telegram first — routing rules
   * for them are stage 6.
   */
  critical: boolean;
  /** Send only to this address (e.g. verifying a new e-mail before it becomes a channel). */
  target?: { channel: ChannelKind; address: string };
}

export interface DispatchResult {
  sentTo: { channel: ChannelKind; address: string }[];
  failed: { channel: ChannelKind; address: string }[];
}

export interface NotificationDispatcher {
  dispatch(db: Db, request: DispatchRequest): Promise<DispatchResult>;
}

function render(locale: Locale, event: NotificationEvent, params: MessageParams) {
  return {
    subject: translate(locale, `notifications.${event}.subject` as MessageKey, params),
    text: translate(locale, `notifications.${event}.text` as MessageKey, params),
  };
}

/**
 * Picks the channels, renders the message in the user's language and hands it to providers.
 * A failing provider does not stop the others: a code must reach the user through any channel.
 */
export function createDispatcher(providers: ChannelProvider[]): NotificationDispatcher {
  const byChannel = new Map(providers.map((p) => [p.channel, p]));

  return {
    async dispatch(db, request) {
      const user = await db.user.findUnique({
        where: { id: request.userId },
        select: {
          locale: true,
          channels: { where: { isEnabled: true, verifiedAt: { not: null } } },
        },
      });
      const result: DispatchResult = { sentTo: [], failed: [] };
      if (!user) return result;

      let targets: { channel: ChannelKind; address: string }[];
      if (request.target) targets = [request.target];
      else if (request.critical) {
        targets = user.channels.map((c) => ({ channel: c.type, address: c.address }));
      } else {
        targets = user.channels
          .filter((c) => c.type === 'TELEGRAM')
          .map((c) => ({ channel: c.type, address: c.address }));
      }

      const locale: Locale = isLocale(user.locale) ? user.locale : 'uz';
      const { subject, text } = render(locale, request.event, request.params);

      for (const target of targets) {
        const provider = byChannel.get(target.channel);
        if (!provider) {
          result.failed.push(target);
          continue;
        }
        try {
          await provider.send({ ...target, subject, text });
          result.sentTo.push(target);
        } catch (error) {
          console.error(`notification to ${target.channel} failed`, error);
          result.failed.push(target);
        }
      }
      return result;
    },
  };
}
