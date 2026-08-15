import { expect, test, vi } from 'vitest';

import { listMicrosoftEvents, normalizeMicrosoftEvent } from '@/lib/providers/microsoft';

const context = {
  connection: { id: 'connection-2', userId: 'user-1', provider: 'microsoft' as const, encryptedAccessToken: 'cipher', encryptedRefreshToken: null },
  calendarId: 'calendar-1', syncedAt: '2026-08-15T12:00:00.000Z',
};

test('normalizes timed recurring Microsoft events as ISO instants and RRULE', () => {
  const event = normalizeMicrosoftEvent({
    id: 'm-42', changeKey: 'version-2', subject: 'Planning', isCancelled: false,
    start: { dateTime: '2026-08-15T10:00:00', timeZone: 'UTC' }, end: { dateTime: '2026-08-15T11:00:00', timeZone: 'UTC' },
    lastModifiedDateTime: '2026-08-01T10:00:00Z',
    recurrence: { pattern: { type: 'weekly', interval: 1, daysOfWeek: ['friday'] }, range: { type: 'endDate', startDate: '2026-08-15', endDate: '2026-12-31' } },
  }, context);

  expect(event).toMatchObject({ provider: 'microsoft', isAllDay: false, startsAt: '2026-08-15T10:00:00.000Z', remoteEventId: 'm-42', status: 'confirmed' });
  expect(event.recurrenceRule).toContain('RRULE:FREQ=WEEKLY');
  expect(event.recurrenceRule).toContain('BYDAY=FR');
});

test('lists Microsoft events only through the Graph calendarView endpoint with GET', async () => {
  const requestMethods: string[] = [];
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    requestMethods.push(init?.method ?? 'GET');
    return new Response(JSON.stringify({ value: [] }), { status: 200 });
  });

  await listMicrosoftEvents({
    calendarId: 'calendar-1', accessToken: 'server-token',
    range: { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' }, fetchImpl,
  });

  expect(requestMethods).toEqual(['GET']);
  expect(fetchImpl.mock.calls[0][0].toString()).toContain('/v1.0/me/calendars/calendar-1/calendarView');
});
