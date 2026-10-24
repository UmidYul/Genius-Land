import { messages } from '@gl/i18n';
import { expect, test } from '@playwright/test';
import { alertWith, codeFor, demo, DEMO_PASSWORD, signIn } from './helpers';

const ru = messages.ru;

test('sign-in with a code from a new device, then sign-out', async ({ page }) => {
  await page.goto('/ru/login');
  const since = Date.now() - 1000;
  // Typed the way people type it — spaces, no country code.
  await page.getByLabel(ru.auth.phone).fill('00 000 00 03');
  await page.getByLabel(ru.auth.password).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: ru.auth.signIn }).click();

  await expect(page).toHaveURL(/\/ru\/login\/verify$/);
  // Where the code went is shown masked.
  await expect(page.getByText('+998 00 *** ** 03')).toBeVisible();

  const code = await codeFor(demo.director.phone, since);
  await page.getByLabel(ru.auth.code).fill(code === '000000' ? '111111' : '000000');
  await page.getByRole('button', { name: ru.auth.confirm }).click();
  await expect(alertWith(page, ru.errors.AUTH_CODE_INVALID)).toBeVisible();

  await page.getByLabel(ru.auth.code).fill(await codeFor(demo.director.phone, since));
  await page.getByRole('button', { name: ru.auth.confirm }).click();
  await expect(page).toHaveURL(/\/ru$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(demo.director.name);

  await page.getByRole('button', { name: ru.topbar.profile }).click();
  await page.getByRole('button', { name: ru.topbar.signOut }).click();
  await expect(page).toHaveURL(/\/ru\/login$/);
  await page.goto('/ru');
  await expect(page).toHaveURL(/\/ru\/login$/);
});

test('a wrong password does not reveal anything and sends no code', async ({ page }) => {
  await page.goto('/ru/login');
  await page.getByLabel(ru.auth.phone).fill(demo.director.phone);
  await page.getByLabel(ru.auth.password).fill('wrongpass1');
  await page.getByRole('button', { name: ru.auth.signIn }).click();
  await expect(alertWith(page, ru.errors.AUTH_INVALID_CREDENTIALS)).toBeVisible();
  await expect(page).toHaveURL(/\/ru\/login$/);
});

test('password reset with a code, then sign-in with the new password', async ({
  page,
}, testInfo) => {
  const newPassword = `newpass${testInfo.project.name.length}${Date.now() % 1000}`;
  await page.goto('/ru/forgot-password');
  const since = Date.now() - 1000;
  await page.getByLabel(ru.auth.phone).fill(demo.teacher.phone);
  await page.getByRole('button', { name: ru.auth.sendCode }).click();
  await expect(page).toHaveURL(/\/ru\/forgot-password\/reset$/);

  await page.getByLabel(ru.auth.code).fill(await codeFor(demo.teacher.phone, since));
  await page.getByLabel(ru.auth.newPassword).fill(newPassword);
  await page.getByLabel(ru.auth.confirmPassword).fill(newPassword);
  await page.getByRole('button', { name: ru.auth.savePassword }).click();

  await expect(page).toHaveURL(/\/ru\/login\?reset=1$/);
  await expect(page.getByRole('status')).toContainText(ru.auth.passwordResetDone);

  await signIn(page, demo.teacher.phone, newPassword, 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(demo.teacher.name);
});

test('founder switches branches; the choice is remembered', async ({ page }) => {
  await signIn(page, demo.founder.phone);
  await expect(page).toHaveURL(/\/ru$/);
  await page.goto('/uz');
  const uz = messages.uz;

  // On a phone the switcher lives in the menu drawer; on wider screens in the top bar.
  const openMenu = page.getByRole('button', { name: uz.nav.openMenu });
  const isPhone = await openMenu.isVisible();
  if (isPhone) await openMenu.click();
  const switcher = page.getByRole('combobox', { name: uz.topbar.branch }).locator('visible=true');
  await expect(switcher).toHaveValue('all');
  await expect(switcher.locator('option')).toHaveText([uz.topbar.allBranches, 'Asosiy', 'Filial']);

  const filialId = await switcher.locator('option', { hasText: /^Filial$/ }).getAttribute('value');
  await switcher.selectOption({ label: 'Filial' });
  await expect(switcher).toHaveValue(filialId!);

  await page.reload();
  if (isPhone) await page.getByRole('button', { name: uz.nav.openMenu }).click();
  await expect(
    page.getByRole('combobox', { name: uz.topbar.branch }).locator('visible=true'),
  ).toHaveValue(filialId!);

  // Back to "all branches" so the test can run again.
  await page
    .getByRole('combobox', { name: uz.topbar.branch })
    .locator('visible=true')
    .selectOption('all');
  await expect(
    page.getByRole('combobox', { name: uz.topbar.branch }).locator('visible=true'),
  ).toHaveValue('all');
});

test('the menu follows permissions', async ({ page }) => {
  const uz = messages.uz;
  await signIn(page, demo.director.phone);
  await page.goto('/uz');
  const openMenu = page.getByRole('button', { name: uz.nav.openMenu });
  if (await openMenu.isVisible()) await openMenu.click();
  const nav = page.getByRole('navigation', { name: uz.nav.mainMenu }).locator('visible=true');
  await expect(nav.getByRole('link', { name: uz.nav.approvals })).toBeVisible();
  await expect(nav.getByRole('link', { name: uz.nav.adminUsers })).toHaveCount(0);
  // A page the menu does not offer does not exist for this user.
  const response = await page.goto('/uz/admin/users');
  expect(response?.status()).toBe(404);
});
