import { expect, test } from '@playwright/test';

test('ana sayfa uygulama adını gösterir', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
});
