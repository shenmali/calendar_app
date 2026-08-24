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
  await rail.evaluate((element) => { element.scrollLeft = 0; });
  const railScrollBeforeSelection = await rail.evaluate((element) => element.scrollLeft);
  await day.click();
  await expect(details).toBeFocused();
  expect(await rail.evaluate((element) => element.scrollLeft)).toBe(railScrollBeforeSelection);
  await expect(details).toHaveCSS('padding', '12px');
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

test('keeps the phone rail stationary when selecting a date in another month', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const rail = page.getByTestId('year-rail');
  const details = page.getByRole('complementary', { name: 'Seçili gün ayrıntıları' });
  const februaryDay = page.getByRole('button', { name: '15 Şubat 2026 gününü seç' });
  await rail.evaluate((element) => {
    const february = element.querySelector<HTMLElement>('[data-month="2026-02"]');
    if (!february) throw new Error('February card is missing');
    element.scrollLeft = february.offsetLeft;
  });

  await expect(februaryDay).toBeInViewport();
  const railScrollBeforeSelection = await rail.evaluate((element) => element.scrollLeft);
  await februaryDay.click();

  await expect(page.getByRole('heading', { name: '15 Şubat 2026' })).toBeVisible();
  await expect(details).toBeFocused();
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBe(railScrollBeforeSelection);
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
