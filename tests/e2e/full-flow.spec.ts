import { expect, test } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;
const sourceName = process.env.PLAYWRIGHT_FULL_FLOW_SOURCE_NAME;
const eventTitle = process.env.PLAYWRIGHT_FULL_FLOW_EVENT_TITLE;
const ready = Boolean(storageState && sourceName && eventTitle);

test.skip(ready === false, 'requires PLAYWRIGHT_STORAGE_STATE plus named, authenticated full-flow test data');
test.use({ storageState: storageState ?? undefined });

test('downloads CSV for the filtered source from the annual calendar view', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('main', { name: /yıllık takvim/i })).toBeVisible();
  await expect(page.getByTestId('year-rail')).toBeVisible();

  const sourceFilters = page.getByRole('group', { name: 'Kaynak filtreleri' });
  const selectedSource = sourceFilters.getByRole('checkbox', { name: sourceName! });
  await expect(selectedSource).toBeVisible();
  if (await selectedSource.isChecked() === false) await selectedSource.check();

  const sourceCheckboxes = sourceFilters.getByRole('checkbox');
  for (let index = 0; index < await sourceCheckboxes.count(); index += 1) {
    const checkbox = sourceCheckboxes.nth(index);
    const label = await checkbox.evaluate((element) => element.parentElement?.textContent?.trim());
    if (label !== sourceName && await checkbox.isChecked()) await checkbox.uncheck();
  }

  await page.getByText('Dışa Aktar', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByText('CSV dosyası', { exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('calendar-export.csv');
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  let csv = '';
  for await (const chunk of stream!) csv += chunk;
  expect(csv).toContain(eventTitle);
});
