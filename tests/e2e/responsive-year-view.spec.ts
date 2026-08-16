import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.skip(!storageState, 'requires an authenticated Supabase storage state');
test.use({ storageState: storageState ?? undefined });

test('keeps selected-day details before the annual grid on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const details = page.getByRole('complementary', { name: 'Seçili gün ayrıntıları' });
  const grid = page.getByTestId('year-grid');
  await expect(details).toBeVisible();
  await expect(grid).toBeVisible();
  const [detailBox, gridBox] = await Promise.all([details.boundingBox(), grid.boundingBox()]);
  expect(detailBox?.y).toBeLessThan(gridBox?.y ?? Number.POSITIVE_INFINITY);
  await expect(page.getByRole('button', { name: '15 Ocak 2026 gününü seç' })).toHaveCSS('min-height', '44px');
});

test('uses three, two, then one annual-grid columns at the documented breakpoints', async ({ page }) => {
  await page.goto('/');
  const firstRow = page.getByTestId('year-grid').getByRole('heading', { level: 2 });

  await page.setViewportSize({ width: 1280, height: 1000 });
  const [firstWide, thirdWide] = await Promise.all([firstRow.nth(0).boundingBox(), firstRow.nth(2).boundingBox()]);
  expect(firstWide?.y).toBe(thirdWide?.y);

  await page.setViewportSize({ width: 1024, height: 1000 });
  const [firstMedium, thirdMedium] = await Promise.all([firstRow.nth(0).boundingBox(), firstRow.nth(2).boundingBox()]);
  expect(thirdMedium?.y).toBeGreaterThan(firstMedium?.y ?? Number.POSITIVE_INFINITY);

  await page.setViewportSize({ width: 390, height: 844 });
  const [firstNarrow, secondNarrow] = await Promise.all([firstRow.nth(0).boundingBox(), firstRow.nth(1).boundingBox()]);
  expect(secondNarrow?.y).toBeGreaterThan(firstNarrow?.y ?? Number.POSITIVE_INFINITY);
});
