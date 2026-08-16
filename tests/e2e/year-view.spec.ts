import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.skip(!storageState, 'requires an authenticated Supabase storage state');

test.use({ storageState: storageState ?? undefined });

test('shows an accessible annual planner and selected-day details without create controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');

  await expect(page.getByRole('main', { name: '2026 yıllık takvim' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Takvim araçları' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Seçili gün ayrıntıları' })).toBeVisible();
  await expect(page.getByTestId('year-grid').getByRole('heading', { level: 2 })).toHaveCount(12);
  await page.getByRole('button', { name: '15 Ocak 2026 gününü seç' }).click();
  await expect(page.getByRole('heading', { name: '15 Ocak 2026' })).toBeVisible();
  await expect(page.getByText('Yeni Etkinlik')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('main', { name: '2026 yıllık takvim' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Takvim araçları' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Seçili gün ayrıntıları' })).toBeVisible();
});
