import { expect, test, vi } from 'vitest';

import { listMicrosoftCalendars, listMicrosoftEvents, normalizeMicrosoftEvent } from '@/lib/providers/microsoft';

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
  expect(event).toMatchObject({ recurrenceRule: expect.stringContaining('RRULE:FREQ=WEEKLY'), providerPayload: { id: 'm-42' } });
  expect((event as { recurrenceRule: string }).recurrenceRule).toContain('BYDAY=FR');
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
  expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({ Prefer: expect.stringContaining('IdType="ImmutableId"') });
});

test('discovers Microsoft calendars with only the default source selected', async () => {
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ Prefer: expect.stringContaining('ImmutableId') });
    return new Response(JSON.stringify({ value: [
      { id: 'team', name: 'Ekip', color: 'lightBlue' },
      { id: 'default', name: 'Takvim', isDefaultCalendar: true, color: 'auto' },
    ] }), { status: 200 });
  });

  await expect(listMicrosoftCalendars({ accessToken: 'server-token', fetchImpl })).resolves.toEqual([
    { id: 'team', name: 'Ekip', color: 'lightBlue', isSelected: false },
    { id: 'default', name: 'Takvim', color: 'auto', isSelected: true },
  ]);
  expect(fetchImpl.mock.calls[0][0].toString()).toContain('/v1.0/me/calendars?$select=');
});

test('exhausts Graph calendarView pages with GET and immutable-id preference', async () => {
  const methods: string[] = [];
  const prefers: string[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    methods.push(init?.method ?? 'GET');
    prefers.push((init?.headers as Record<string, string>).Prefer);
    return new Response(JSON.stringify(url.toString().includes('skiptoken=two')
      ? { value: [{ id: 'm-2' }] }
      : { value: [{ id: 'm-1' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendars/calendar-1/calendarView?skiptoken=two' }), { status: 200 });
  });

  const events = await listMicrosoftEvents({ calendarId: 'calendar-1', accessToken: 'server-token', range: { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' }, fetchImpl });

  expect(events.map((event) => event.id)).toEqual(['m-1', 'm-2']);
  expect(methods).toEqual(['GET', 'GET']);
  expect(prefers).toEqual([expect.stringContaining('IdType="ImmutableId"'), expect.stringContaining('IdType="ImmutableId"')]);
});
