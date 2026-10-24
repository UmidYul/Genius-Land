import { messages } from '@gl/i18n';
import { expect, test, type Page } from '@playwright/test';
import { demo, signIn } from './helpers';

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

for (const locale of ['uz', 'ru'] as const) {
  test(`sign-in page opens in ${locale}; the cabinet requires a session`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(
      page.getByRole('heading', { level: 1, name: messages[locale].auth.title }),
    ).toBeVisible();
    await noHorizontalOverflow(page);
  });
}

test('root redirects to Uzbek by default', async ({ page }) => {
  await page.context().clearCookies();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en' });
  await page.goto('/');
  await expect(page).toHaveURL(/\/uz\/login$/);
});

test('home opens in uz and ru after sign-in', async ({ page }) => {
  await signIn(page, demo.director.phone);
  // Demo users prefer Russian: after sign-in the cabinet opens in their language.
  await expect(page).toHaveURL(/\/ru$/);
  for (const locale of ['ru', 'uz'] as const) {
    await page.goto(`/${locale}`);
    const greeting = messages[locale].home.greeting.replace('{name}', demo.director.name);
    await expect(page.getByRole('heading', { level: 1, name: greeting })).toBeVisible();
    await noHorizontalOverflow(page);
  }
});

test('language switch keeps the page', async ({ page }) => {
  await page.goto('/uz/login');
  await page.getByRole('button', { name: messages.uz.locale.ru }).click();
  await expect(page).toHaveURL(/\/ru\/login$/);
  await expect(page.getByRole('heading', { level: 1, name: messages.ru.auth.title })).toBeVisible();
});

test('theme survives a language switch', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('gl-theme', 'dark'));
  await page.goto('/uz/login');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: messages.uz.locale.ru }).click();
  await expect(page).toHaveURL(/\/ru\/login$/);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
