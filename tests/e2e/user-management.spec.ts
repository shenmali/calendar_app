import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.skip(!storageState, 'requires an authenticated owner Supabase storage state');
test.use({ storageState: storageState ?? undefined });

test('owner can open the user management settings page', async ({ page }) => {
  await page.goto('/settings/users');

  await expect(page.getByRole('main', { name: 'Kullanıcı yönetimi' })).toBeVisible();
  await expect(page.getByLabel('E-posta')).toBeVisible();
});
