import { messages } from '@gl/i18n';
import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { outboxFile } from './paths';

export const DEMO_PASSWORD = 'demo12345';

export const demo = {
  superadmin: { phone: '+998000000001', name: 'Суперадмин (демо)' },
  founder: { phone: '+998000000002', name: 'Основатель (демо)' },
  director: { phone: '+998000000003', name: 'Директор основного (демо)' },
  teacher: { phone: '+998000000006', name: 'Учитель (демо)' },
} as const;

interface OutboxMessage {
  at: string;
  channel: string;
  address: string;
  text: string;
}

/** Waits for a message to `address` sent after `since` and returns its 6-digit code. */
export async function codeFor(address: string, since: number): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      () => {
        const lines = readFileSync(outboxFile, 'utf8').trim().split('\n').filter(Boolean);
        const message = lines
          .map((line) => JSON.parse(line) as OutboxMessage)
          .filter((m) => m.address === address && Date.parse(m.at) >= since)
          .at(-1);
        code = message ? /\b(\d{6})\b/.exec(message.text)?.[1] : undefined;
        return code;
      },
      { timeout: 10_000 },
    )
    .toBeTruthy();
  return code!;
}

/** Full sign-in on a new device: phone + password, then the code from SMS. */
export async function signIn(
  page: Page,
  phone: string,
  password = DEMO_PASSWORD,
  locale: 'uz' | 'ru' = 'uz',
) {
  const t = messages[locale].auth;
  await page.goto(`/${locale}/login`);
  const since = Date.now() - 1000;
  await page.getByLabel(t.phone).fill(phone);
  await page.getByLabel(t.password).fill(password);
  await page.getByRole('button', { name: t.signIn }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/login/verify$`));
  await page.getByLabel(t.code).fill(await codeFor(phone, since));
  await page.getByRole('button', { name: t.confirm }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A form message (Next.js also renders an empty role=alert route announcer). */
export const alertWith = (page: Page, text: string) =>
  page.getByRole('alert').filter({ hasText: text });
