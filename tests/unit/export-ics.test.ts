import { expect, test } from 'vitest';

import { createIcs } from '@/lib/export/ics';
import type { ExportCalendarEvent } from '@/lib/export/types';

const timedEvent: ExportCalendarEvent = {
  id: 'event-1', remoteEventId: 'g-42', connectionId: 'connection-google', sourceId: 'source-work', sourceCalendarId: 'primary',
  provider: 'google', title: 'Toplantı, planlama; geri\\dönüş\nnotu', description: 'Birinci satır\nİkinci satır', location: 'Ofis; Kat 2',
  startsAt: '2026-08-15T07:00:00.000Z', endsAt: '2026-08-15T08:30:00.000Z', isAllDay: false, status: 'confirmed',
  sourceName: 'İş', sourceIsSelected: true,
};

const allDayEvent: ExportCalendarEvent = {
  ...timedEvent, id: 'event-2', remoteEventId: 'm-9', provider: 'microsoft', title: 'İzin', startsAt: '2026-08-15', endsAt: '2026-08-16', isAllDay: true,
};

test('exports escaped timed and all-day events in RFC-style deterministic ICS', () => {
  const ics = createIcs([timedEvent, allDayEvent]);

  expect(ics).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Takvim//Calendar Export//TR\r\n');
  expect(ics).toContain('UID:google:connection-google:g-42\r\n');
  expect(ics).toContain('DTSTAMP:20260815T070000Z\r\n');
  expect(ics).toContain('DTSTART:20260815T070000Z\r\nDTEND:20260815T083000Z\r\n');
  expect(ics).toContain('SUMMARY:Toplantı\\, planlama\\; geri\\\\dönüş\\nnotu\r\n');
  expect(ics).toContain('DESCRIPTION:Birinci satır\\nİkinci satır\r\n');
  expect(ics).toContain('LOCATION:Ofis\\; Kat 2\r\n');
  expect(ics).toContain('UID:microsoft:connection-google:m-9\r\n');
  expect(ics).toContain('DTSTART;VALUE=DATE:20260815\r\nDTEND;VALUE=DATE:20260816\r\n');
  expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
});

test('keeps identical remote IDs from separate connections unique', () => {
  const ics = createIcs([{ ...timedEvent, connectionId: 'connection-a' }, { ...timedEvent, id: 'event-2', connectionId: 'connection-b' }]);

  expect(ics).toContain('UID:google:connection-a:g-42\r\n');
  expect(ics).toContain('UID:google:connection-b:g-42\r\n');
});

test('folds long UTF-8 ICS content lines without splitting a multibyte character', () => {
  const ics = createIcs([{ ...timedEvent, title: 'İ'.repeat(80) }]);
  const physicalLines = ics.split('\r\n').filter(Boolean);

  expect(physicalLines.some((line) => line.startsWith(' '))).toBe(true);
  expect(physicalLines.every((line) => Buffer.byteLength(line, 'utf8') <= 75)).toBe(true);
});
