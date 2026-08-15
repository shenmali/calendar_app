import { expect, test } from '@playwright/test';

test('oturumu olmayan ziyaretçiyi giriş sayfasına yönlendirir', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Takvime giriş' })).toBeVisible();
});

test('izin verilmeyen e-posta adresi için magic link istemez', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-posta adresi').fill('other@example.com');
  await page.getByRole('button', { name: 'Magic link gönder' }).click();

  await expect(page.getByText('Bu e-posta adresinin erişim izni yok.')).toBeVisible();
});
