import { describe, expect, it } from 'vitest';
import { messages, translate } from './index';

function flatten(node: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dictionaries', () => {
  const uz = flatten(messages.uz);
  const ru = flatten(messages.ru);

  it('uz and ru have exactly the same keys', () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(uz).sort());
  });

  it('no message is empty', () => {
    for (const [key, value] of [...Object.entries(uz), ...Object.entries(ru)]) {
      expect(value.trim(), key).not.toBe('');
    }
  });

  it('placeholders match between languages', () => {
    for (const key of Object.keys(uz)) {
      expect(placeholders(ru[key] ?? ''), key).toEqual(placeholders(uz[key] ?? ''));
    }
  });

  it('Uzbek uses the letters oʻ/gʻ (U+02BB), not ASCII apostrophes', () => {
    for (const [key, value] of Object.entries(uz)) {
      expect(value, key).not.toMatch(/['`‘’]/);
    }
  });
});

describe('translate', () => {
  it('returns the message for the locale', () => {
    expect(translate('ru', 'nav.home')).toBe('Главная');
    expect(translate('uz', 'nav.home')).toBe('Bosh sahifa');
  });

  it('substitutes params', () => {
    expect(translate('ru', 'errors.SETTING_UNKNOWN', { key: 'x.y' })).toBe(
      'Неизвестная настройка: x.y.',
    );
  });
});
