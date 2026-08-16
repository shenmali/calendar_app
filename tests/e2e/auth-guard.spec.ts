import { expect, test } from '@playwright/test';

test('redirects an unauthenticated visitor to login', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Takvime giriş' })).toBeVisible();
});

test('redirects an unauthenticated visitor from another application route', async ({ page }) => {
  await page.goto('/settings');

  await expect(page).toHaveURL(/\/login$/);
});

test('cron bearer handler is reachable while an ordinary protected API is guarded by middleware', async ({ request }) => {
  const cron = await request.get('/api/cron/sync', { maxRedirects: 0 });
  const protectedApi = await request.post('/api/sync', { maxRedirects: 0 });

  expect(cron.status()).toBe(401);
  await expect(cron.json()).resolves.toEqual({ error: 'Unauthorized' });
  expect(protectedApi.status()).toBe(307);
  expect(protectedApi.headers().location).toMatch(/\/login$/);
});

test('does not serialize the configured allowed email into the login response', async ({ page }) => {
  await page.goto('/login');

  expect(await page.content()).not.toContain('private-allowed@example.com');
});
