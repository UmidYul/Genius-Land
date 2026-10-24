import { messages } from '@gl/i18n';
import { expect, test } from '@playwright/test';

for (const locale of ['uz', 'ru'] as const) {
  test(`home opens in ${locale}`, async ({ page }) => {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(
      page.getByRole('heading', { level: 1, name: messages[locale].home.title }),
    ).toBeVisible();

    // Nothing may overflow the viewport horizontally (360 px phones included).
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('root redirects to Uzbek by default', async ({ page }) => {
  await page.context().clearCookies();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en' });
  await page.goto('/');
  await expect(page).toHaveURL(/\/uz$/);
});

test('language switch keeps the page', async ({ page }) => {
  await page.goto('/uz');
  await page.getByRole('button', { name: messages.uz.locale.ru }).click();
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.getByRole('heading', { level: 1, name: messages.ru.home.title })).toBeVisible();
});
