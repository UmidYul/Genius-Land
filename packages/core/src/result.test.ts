import { messages } from '@gl/i18n';
import { describe, expect, it } from 'vitest';
import { DomainError, err, errorCodes, errorMessage, ok, unwrap } from './result';

describe('Result', () => {
  it('ok / err shapes', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('NOT_FOUND')).toEqual({ ok: false, error: { code: 'NOT_FOUND' } });
    expect(err('VALIDATION', undefined, { amount: 'MONEY_NEGATIVE' })).toEqual({
      ok: false,
      error: { code: 'VALIDATION', fields: { amount: 'MONEY_NEGATIVE' } },
    });
  });

  it('unwrap throws DomainError with the code', () => {
    expect(unwrap(ok('x'))).toBe('x');
    expect(() => unwrap(err('FORBIDDEN'))).toThrow(DomainError);
    try {
      unwrap(err('SETTING_UNKNOWN', { key: 'a' }));
    } catch (error) {
      expect((error as DomainError).toAppError()).toEqual({
        code: 'SETTING_UNKNOWN',
        params: { key: 'a' },
      });
    }
  });
});

describe('error texts', () => {
  it('every error code has a text in both languages', () => {
    for (const locale of ['uz', 'ru'] as const) {
      const dictionary = messages[locale].errors as Record<string, string>;
      for (const code of errorCodes) expect(dictionary[code], `${locale}.${code}`).toBeTruthy();
    }
  });

  it('dictionaries have no orphan error texts', () => {
    expect(Object.keys(messages.uz.errors).sort()).toEqual([...errorCodes].sort());
  });

  it('errorMessage substitutes params', () => {
    expect(errorMessage({ code: 'SETTING_INVALID', params: { key: 'k' } }, 'ru')).toBe(
      'Неверное значение настройки: k.',
    );
  });
});
