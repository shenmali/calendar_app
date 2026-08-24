import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.skip(!storageState, 'requires an authenticated Supabase storage state');

test.use({ storageState: storageState ?? undefined });

test('shows an accessible annual rail and selected-day details without create controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('main', { name: '2026 yıllık takvim' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Takvim araçları' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Seçili gün ayrıntıları' })).toBeVisible();
  const rail = page.getByTestId('year-rail');
  const selectedMonth = rail.locator('[data-selected-month="0"]');
  await expect(rail.getByRole('heading', { level: 2 })).toHaveCount(12);
  await expect(selectedMonth).toBeVisible();
  expect(await rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const [firstMonth, thirdMonth] = await Promise.all([
    rail.getByRole('heading', { level: 2 }).nth(0).boundingBox(),
    rail.getByRole('heading', { level: 2 }).nth(2).boundingBox(),
  ]);
  expect(firstMonth?.y).toBe(thirdMonth?.y);
  expect(await rail.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
    return element.scrollLeft;
  })).toBeGreaterThan(0);
  await expect(rail.getByRole('heading', { level: 2 }).nth(11)).toBeInViewport();
  await page.getByRole('button', { name: '15 Ocak 2026 gününü seç' }).click();
  await expect(page.getByRole('heading', { name: '15 Ocak 2026' })).toBeVisible();
  await expect(page.getByText('Yeni Etkinlik')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('main', { name: '2026 yıllık takvim' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Takvim araçları' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Seçili gün ayrıntıları' })).toBeVisible();
  await expect(page.getByTestId('year-rail')).toBeVisible();
});

test('keeps the annual rail horizontal and scrollable at intermediate breakpoints', async ({ page }) => {
  await page.goto('/');

  const rail = page.getByTestId('year-rail');
  const selectedMonth = rail.locator('[data-selected-month="0"]');
  const headings = rail.getByRole('heading', { level: 2 });

  for (const width of [1280, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(rail).toBeVisible();
    await expect(selectedMonth).toBeVisible();
    expect(await rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    const [firstMonth, thirdMonth] = await Promise.all([headings.nth(0).boundingBox(), headings.nth(2).boundingBox()]);
    expect(firstMonth?.y).toBe(thirdMonth?.y);
    const scrollPosition = await rail.evaluate((element) => {
      element.scrollLeft = 0;
      const before = element.scrollLeft;
      element.scrollLeft = element.scrollWidth - element.clientWidth;
      return { after: element.scrollLeft, before };
    });
    expect(scrollPosition.after).toBeGreaterThan(scrollPosition.before);
    await expect(headings.nth(11)).toBeInViewport();
  }
});
