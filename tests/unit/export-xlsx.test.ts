import { expect, test } from 'vitest';

import { createXlsx } from '@/lib/export/xlsx';
import type { ExportCalendarEvent } from '@/lib/export/types';

const event: ExportCalendarEvent = {
  id: 'event-1', remoteEventId: 'g-42', connectionId: 'connection-google', sourceId: 'source-work', sourceCalendarId: 'primary', provider: 'google',
  title: 'Planlama', description: 'Açıklama', location: 'Ofis', startsAt: '2026-08-15T07:00:00.000Z', endsAt: '2026-08-15T08:30:00.000Z',
  isAllDay: false, status: 'confirmed', sourceName: 'İş', sourceIsSelected: true,
};

test('creates a readable workbook with typed date and boolean cells', async () => {
  const { read } = await import('xlsx-js-style');
  const workbook = read(createXlsx([event]), { type: 'array', cellDates: true, cellStyles: true });
  const sheet = workbook.Sheets.Etkinlikler;

  expect(sheet).toBeDefined();
  expect(workbook.SheetNames).toEqual(['Etkinlikler']);
  expect(['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1'].map((cell) => sheet?.[cell].v)).toEqual(['Başlık', 'Başlangıç', 'Bitiş', 'Tüm Gün', 'Konum', 'Kaynak', 'Takvim', 'Açıklama']);
  expect(sheet?.A2.v).toBe('Planlama');
  expect(sheet?.B2.v).toBeInstanceOf(Date);
  expect(sheet?.D2.v).toBe(false);
  expect(sheet?.['!cols']?.[0].wpx ?? sheet?.['!cols']?.[0].wch).toBeGreaterThan(10);
});

test('writes an Istanbul wall-clock Excel serial that does not depend on the host timezone', async () => {
  const { read } = await import('xlsx-js-style');
  const workbook = read(createXlsx([event]), { type: 'array', cellDates: false });
  const serial = workbook.Sheets.Etkinlikler?.B2.v;
  const expected = (Date.UTC(2026, 7, 15, 10, 0, 0) - Date.UTC(1899, 11, 30)) / 86_400_000;

  expect(serial).toBe(expected);
});

test('stores all-day bounds as Excel dates rather than text', async () => {
  const { read } = await import('xlsx-js-style');
  const workbook = read(createXlsx([{ ...event, isAllDay: true, startsAt: '2026-08-15', endsAt: '2026-08-16' }]), {
    type: 'array', cellDates: true,
  });
  const sheet = workbook.Sheets.Etkinlikler;

  expect(sheet?.B2.v).toBeInstanceOf(Date);
  expect(sheet?.C2.v).toBeInstanceOf(Date);
  expect(sheet?.D2.v).toBe(true);
});

test('preserves a readable styled header in the generated workbook', async () => {
  const { read } = await import('xlsx-js-style');
  const workbook = read(createXlsx([event]), { type: 'array', cellStyles: true });
  const header = workbook.Sheets.Etkinlikler?.A1;

  expect(header?.s?.patternType).toBe('solid');
  expect(header?.s?.fgColor?.rgb).toBe('0F766E');
});
