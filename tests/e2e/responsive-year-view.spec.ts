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
  expect(secondMonth?.y).toBeGreaterThan(firstMonth?.y ?? Number.NEGATIVE_INFINITY);
  expect(secondMonth?.x).toBe(firstMonth?.x);
  const januaryStrip = page.getByTestId('month-day-strip').first();
  expect(await januaryStrip.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await januaryStrip.evaluate((element) => { element.scrollLeft = 1000; });
  const stripScrollBeforeSelection = await januaryStrip.evaluate((element) => element.scrollLeft);
  await day.click();
  await expect(details).toBeFocused();
  expect(await januaryStrip.evaluate((element) => element.scrollLeft)).toBe(stripScrollBeforeSelection);
  const januarySection = rail.locator('[data-month="2026-01"]');
  const [januaryBox, selectedDetailBox] = await Promise.all([januarySection.boundingBox(), details.boundingBox()]);
  expect(selectedDetailBox?.y).toBeGreaterThan(januaryBox?.y ?? Number.NEGATIVE_INFINITY);
  expect(selectedDetailBox?.y).toBeLessThan((januaryBox?.y ?? 0) + (januaryBox?.height ?? Number.POSITIVE_INFINITY) + 24);
  await expect(details).toHaveCSS('padding', '16px');
  await expect(details).toHaveCSS('position', 'static');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const today = page.getByRole('button', { name: 'Bugün' });
  const secondaryControls = [
    page.getByRole('group', { name: 'Takvim görünümü' }),
    page.getByRole('button', { name: 'Bağlantılar' }),
    page.getByRole('button', { name: 'Yenile' }),
    page.getByText('Dışa Aktar', { exact: true }),
  ];
  const todayBox = await today.boundingBox();
  for (const control of secondaryControls) {
    const controlBox = await control.boundingBox();
    expect(controlBox?.y).toBeGreaterThan((todayBox?.y ?? 0) + (todayBox?.height ?? 0));
  }
});

test('keeps a phone month day strip stationary when selecting a date', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const details = page.getByRole('complementary', { name: 'Seçili gün ayrıntıları' });
  const februaryDay = page.getByRole('button', { name: '2 Şubat 2026 gününü seç' });
  const februaryStrip = page.getByTestId('month-day-strip').nth(1);
  await februaryStrip.evaluate((element) => { element.scrollLeft = 48; });

  const stripScrollBeforeSelection = await februaryStrip.evaluate((element) => element.scrollLeft);
  await februaryDay.click();

  await expect(page.getByRole('heading', { name: '2 Şubat 2026' })).toBeVisible();
  await expect(details).toBeFocused();
  await expect.poll(() => februaryStrip.evaluate((element) => element.scrollLeft)).toBe(stripScrollBeforeSelection);
});

test('reveals the newly selected January strip after a phone year change', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const rail = page.getByTestId('year-rail');
  await page.getByRole('heading', { name: 'Aralık 2026' }).scrollIntoViewIfNeeded();
  await expect(rail.getByRole('heading', { name: 'Aralık 2026' })).toBeInViewport();

  await page.getByRole('button', { name: 'Sonraki yıl' }).click();

  await expect(page.getByRole('main', { name: '2027 yıllık takvim' })).toBeVisible();
  await expect(rail.locator('[data-month="2027-01"][data-selected-month="0"]')).toBeInViewport();
});

test('uses immediate mobile detail reveal when reduced motion is requested', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const calls: Array<{ behavior?: ScrollBehavior; label?: string }> = [];
    (window as unknown as { __detailScrollCalls: typeof calls }).__detailScrollCalls = calls;
    Element.prototype.scrollIntoView = function scrollIntoView(options?: boolean | ScrollIntoViewOptions) {
      calls.push({
        behavior: typeof options === 'object' ? options.behavior : undefined,
        label: this instanceof HTMLElement ? this.getAttribute('aria-label') ?? undefined : undefined,
      });
    };
  });
  await page.goto('/');

  await page.getByRole('button', { name: '15 Ocak 2026 gününü seç' }).click();

  await expect.poll(() => page.evaluate(() => (
    window as unknown as { __detailScrollCalls: Array<{ behavior?: ScrollBehavior; label?: string }> }
  ).__detailScrollCalls)).toContainEqual({ behavior: 'auto', label: 'Seçili gün ayrıntıları' });
});
