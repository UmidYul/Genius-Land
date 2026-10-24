import ru from './messages/ru.json' with { type: 'json' };
import uz from './messages/uz.json' with { type: 'json' };

export const locales = ['uz', 'ru'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'uz';

/** The Uzbek dictionary is the reference shape; the Russian one must match it key for key. */
export type Messages = typeof uz;

export const messages: Record<Locale, Messages> = { uz, ru };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : Join<K, Paths<T[K]>>;
}[keyof T & string];

/** Every dotted key of the dictionary, e.g. `errors.NOT_FOUND`. */
export type MessageKey = Paths<Messages>;
export type MessageParams = Record<string, string | number>;

/**
 * Translator for code outside React (worker, bot, notification templates).
 * Supports plain `{param}` placeholders — the same syntax next-intl uses for simple arguments.
 * An unknown key returns the key itself so a missing text is visible, not silent.
 */
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  let node: unknown = messages[locale];
  for (const part of key.split('.')) {
    node =
      typeof node === 'object' && node !== null
        ? (node as Record<string, unknown>)[part]
        : undefined;
  }
  if (typeof node !== 'string') return key;
  if (!params) return node;
  return node.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
