import { expect, test } from 'vitest';

import { createCsv } from '@/lib/export/csv';
import type { ExportCalendarEvent } from '@/lib/export/types';

const event: ExportCalendarEvent = {
  id: 'event-1', remoteEventId: 'g-42', connectionId: 'connection-google', sourceId: 'source-work', sourceCalendarId: 'primary', provider: 'google',
  title: '=HYPERLINK("https://unsafe.example", "click")', description: 'Satır 1\n"Satır 2"', location: 'A, Blok',
  startsAt: '2026-08-15T07:00:00.000Z', endsAt: '2026-08-15T08:30:00.000Z', isAllDay: false, status: 'confirmed', sourceName: 'İş', sourceIsSelected: true,
};

test('exports Turkish columns, UTF-8 BOM, quoted fields, and safe untrusted text', () => {
  const csv = createCsv([event]);

  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv).toContain('Başlık,Başlangıç,Bitiş,Tüm Gün,Konum,Kaynak,Takvim,Açıklama\r\n');
  expect(csv).toContain("'=");
  expect(csv).toContain('"A, Blok"');
  expect(csv).toContain('"Satır 1\n""Satır 2"""');
  expect(csv).toContain(',Google,İş,');
});
