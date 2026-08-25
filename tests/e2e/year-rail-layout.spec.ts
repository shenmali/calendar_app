import { expect, test } from '@playwright/test';
import path from 'node:path';
import { createViteServer } from 'vitest/node';

async function renderAnnualRail(): Promise<string> {
  const vite = await createViteServer({
    appType: 'custom',
    configFile: false,
    resolve: { alias: { '@': path.resolve(process.cwd()) } },
    server: { middlewareMode: true },
  });
  try {
    const renderer = await vite.ssrLoadModule('/tests/fixtures/year-rail-markup.ts') as {
      renderAnnualRailMarkup: () => string;
    };
    return renderer.renderAnnualRailMarkup();
  } finally {
    await vite.close();
  }
}

test('keeps narrow-phone annual day buttons compact and touch-sized inside every month day strip', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/login');
  await page.locator('body').evaluate((body, markup) => { body.innerHTML = markup; }, await renderAnnualRail());

  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 844 });
    const dayBox = await page.getByRole('button', { name: '15 Ocak 2026 gününü seç' }).boundingBox();
    if (!dayBox) throw new Error(`January day button is missing at ${width}px`);
    expect(dayBox.width).toBeGreaterThanOrEqual(44);
    expect(dayBox.height).toBeGreaterThanOrEqual(44);
    expect(dayBox.height).toBeLessThanOrEqual(108);
  }

  const rail = page.getByTestId('year-rail');
  const monthStrips = page.getByTestId('month-day-strip');
  expect(await monthStrips.count()).toBe(12);
  expect(await monthStrips.first().evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const januaryBox = await monthStrips.first().boundingBox();
  const februaryBox = await monthStrips.nth(1).boundingBox();
  if (!januaryBox || !februaryBox) throw new Error('Month day strips are missing at 360px');
  expect(februaryBox.y).toBeGreaterThan(januaryBox.y);
  expect(await rail.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
