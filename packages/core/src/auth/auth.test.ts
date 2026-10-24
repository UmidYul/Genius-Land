import { messages } from '@gl/i18n';
import { describe, expect, it } from 'vitest';
import { permissionCodes, splitPermission } from '../access/permissions';
import { roleCodes } from '../access/roles';
import { settingsRegistry } from '../admin/settings-admin';
import { generateCode } from './otp';
import { generateTemporaryPassword, validatePassword } from './password';
import { maskEmail, maskPhone, normalizeEmail, normalizePhone } from './phone';

describe('phones', () => {
  it.each([
    ['+998901234567', '+998901234567'],
    ['+998 90 123-45-67', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['90 123 45 67', '+998901234567'],
    ['(90) 123.45.67', '+998901234567'],
  ])('%s → %s', (input, expected) => expect(normalizePhone(input)).toBe(expected));

  it.each(['', '12345', '+7 900 123 45 67', '+9989012345678', 'abc'])('rejects %j', (input) =>
    expect(normalizePhone(input)).toBeNull(),
  );

  it('masks', () => {
    expect(maskPhone('+998901234567')).toBe('+998 90 *** ** 67');
    expect(maskEmail('user@example.com')).toBe('u***@example.com');
    expect(normalizeEmail(' User@Example.COM ')).toBe('user@example.com');
    expect(normalizeEmail('nope')).toBeNull();
  });
});

describe('passwords', () => {
  it.each(['abc12345', 'Пароль123', 'longpassword1'])('accepts %j', (p) =>
    expect(validatePassword(p).ok).toBe(true),
  );
  it.each(['short1a', 'onlyletters', '12345678', ''])('rejects %j', (p) =>
    expect(validatePassword(p)).toMatchObject({ ok: false, error: { code: 'PASSWORD_WEAK' } }),
  );
  it('temporary passwords satisfy the policy and differ', () => {
    const list = Array.from({ length: 50 }, () => generateTemporaryPassword());
    for (const p of list) expect(validatePassword(p).ok, p).toBe(true);
    expect(new Set(list).size).toBe(list.length);
  });
});

describe('codes', () => {
  it('are 6 digits', () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe('dictionary coverage of the access model', () => {
  const uz = messages.uz as unknown as Record<string, Record<string, Record<string, string>>>;

  it('every role and scope has a name', () => {
    for (const code of roleCodes) expect(messages.uz.roles[code], code).toBeTruthy();
  });

  it('every permission has module, resource and action labels', () => {
    for (const code of permissionCodes) {
      const { module, resource, action } = splitPermission(code);
      expect(uz.access?.modules?.[module], `${code} module`).toBeTruthy();
      expect(uz.access?.resources?.[resource], `${code} resource`).toBeTruthy();
      expect(uz.access?.actions?.[action], `${code} action`).toBeTruthy();
    }
  });

  it('every registered setting has a label and a hint', () => {
    for (const def of settingsRegistry) {
      let node: unknown = messages.uz.settings;
      for (const part of def.key.split('.')) node = (node as Record<string, unknown>)?.[part];
      const entry = node as { label?: string; hint?: string } | undefined;
      expect(entry?.label, def.key).toBeTruthy();
      expect(entry?.hint, def.key).toBeTruthy();
    }
  });
});
