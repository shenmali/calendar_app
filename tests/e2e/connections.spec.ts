import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.skip(!storageState, 'requires an authenticated Supabase storage state');
test.use({ storageState: storageState ?? undefined });

test('manages safe connection metadata and source UUID selections without rendering secrets', async ({ page }) => {
  const sourceId = '90cab0d1-e98d-492a-9cd3-4ef9f8bb01f8';
  const connectionId = '10721c2c-eebf-496b-a84e-6895b02dbff3';
  let selectionSaved = false;

  await page.route('**/api/connections', async (route) => {
    await route.fulfill({ json: {
      connections: [{ id: connectionId, provider: 'google', providerAccountId: 'calendar-owner@example.com', scopes: [], tokenExpiresAt: '2020-01-01T00:00:00.000Z', isActive: true, lastSyncedAt: null, createdAt: '2020-01-01T00:00:00.000Z' }],
      sources: [{ id: sourceId, connectionId, name: 'Work calendar', color: '#0284c7', isSelected: true }],
    } });
  });
  await page.route(`**/api/calendar-sources/${sourceId}`, async (route) => {
    selectionSaved = route.request().method() === 'PATCH' && (await route.request().postDataJSON()).isSelected === false;
    await route.fulfill({ json: { sourceId, isSelected: false } });
  });
  await page.route(`**/api/connections/${connectionId}`, async (route) => {
    await route.fulfill({ json: { deleted: true } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Bağlantılar' }).click();
  await expect(page.getByRole('dialog', { name: 'Bağlantılar' })).toBeVisible();
  await expect(page.getByText('İznin süresi dolmuş. Yeniden bağlanın.')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Work calendar' }).uncheck();
  await expect.poll(() => selectionSaved).toBe(true);
  await page.getByRole('button', { name: 'Bağlantıyı kaldır' }).click();
  await expect(page.getByText('Bağlantı kaldırıldı.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('access_token');
  await expect(page.locator('body')).not.toContainText('refresh_token');
});
