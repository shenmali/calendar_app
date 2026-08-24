import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.skip(!storageState, 'requires an authenticated Supabase storage state');
test.use({ storageState: storageState ?? undefined });

test('keeps the annual rail before selected-day details and focuses them on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const details = page.getByRole('complementary', { name: 'Seçili gün ayrıntıları' });
  const rail = page.getByTestId('year-rail');
  await expect(details).toBeVisible();
  await expect(rail).toBeVisible();
  const [detailBox, railBox] = await Promise.all([details.boundingBox(), rail.boundingBox()]);
  expect(railBox?.y).toBeLessThan(detailBox?.y ?? Number.POSITIVE_INFINITY);
  const day = page.getByRole('button', { name: '15 Ocak 2026 gününü seç' });
  await expect(day).toHaveCSS('min-height', '44px');
  const headings = rail.getByRole('heading', { level: 2 });
  const [firstMonth, secondMonth] = await Promise.all([headings.nth(0).boundingBox(), headings.nth(1).boundingBox()]);
  expect(secondMonth?.x).toBeGreaterThan(firstMonth?.x ?? Number.POSITIVE_INFINITY);
  expect(secondMonth?.y).toBe(firstMonth?.y);
  const scrollPosition = await rail.evaluate((element) => {
    const before = element.scrollLeft;
    element.scrollLeft = element.scrollWidth - element.clientWidth;
    return { after: element.scrollLeft, before };
  });
  expect(scrollPosition.after).toBeGreaterThan(scrollPosition.before);
  await expect(headings.nth(11)).toBeInViewport();
  await day.click();
  await expect(details).toBeFocused();
});
