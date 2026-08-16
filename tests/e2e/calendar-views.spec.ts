import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.skip(!storageState, 'requires an authenticated Supabase storage state');
test.use({ storageState: storageState ?? undefined });

test('defaults to the annual view and keeps the chosen view in the URL', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('year-grid')).toBeVisible();
  await expect(page).not.toHaveURL(/view=/);

  await page.getByRole('button', { name: 'Hafta' }).click();
  await expect(page).toHaveURL(/\?view=week/);
  await expect(page.getByTestId('week-view')).toBeVisible();

  await page.getByRole('button', { name: 'Gün' }).click();
  await expect(page).toHaveURL(/\?view=day/);
  await expect(page.getByTestId('day-view')).toBeVisible();

  await page.getByRole('button', { name: 'Yıl' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByTestId('year-grid')).toBeVisible();
});
