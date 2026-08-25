import { expect, test, vi } from 'vitest';

import { listGoogleCalendars, listGoogleEvents, normalizeGoogleEvent } from '@/lib/providers/google';

const context = {
  connection: { id: 'connection-1', userId: 'user-1', provider: 'google' as const, encryptedAccessToken: 'cipher', encryptedRefreshToken: null },
  calendarId: 'primary',
  syncedAt: '2026-08-15T12:00:00.000Z',
};

test('normalizes an all-day Google event without applying a display timezone', () => {
  const event = normalizeGoogleEvent({
    id: 'g-42', etag: '"v1"', status: 'confirmed', summary: 'Holiday',
    start: { date: '2026-08-15' }, end: { date: '2026-08-16' }, updated: '2026-08-01T10:00:00.000Z',
  }, context);

  expect(event).toMatchObject({
    provider: 'google', isAllDay: true, startsAt: '2026-08-15', endsAt: '2026-08-16',
    remoteEventId: 'g-42', remoteVersion: '"v1"', status: 'confirmed',
  });
});

test('preserves cancelled Google events and their RFC5545 recurrence rule', () => {
  const event = normalizeGoogleEvent({
    id: 'g-cancelled', status: 'cancelled', summary: 'Removed',
    start: { dateTime: '2026-08-15T10:00:00+02:00' }, end: { dateTime: '2026-08-15T11:00:00+02:00' },
    recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=FR'],
  }, context);

  expect(event).toMatchObject({ status: 'cancelled', recurrenceRule: 'RRULE:FREQ=WEEKLY;BYDAY=FR', remoteSeriesId: null, providerPayload: { id: 'g-cancelled' } });
});

test('normalizes an id-only Google cancellation as a non-destructive tombstone', () => {
  expect(normalizeGoogleEvent({ id: 'g-tombstone', status: 'cancelled' }, context)).toMatchObject({
    kind: 'cancellation', remoteEventId: 'g-tombstone', remoteVersion: null, providerPayload: { id: 'g-tombstone' },
  });
});

test('lists Google events through a GET-only Events API request', async () => {
  const requestMethods: string[] = [];
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    requestMethods.push(init?.method ?? 'GET');
    return new Response(JSON.stringify({ items: [] }), { status: 200 });
  });

  await expect(listGoogleEvents({
    calendarId: 'team/calendar', accessToken: 'server-token',
    range: { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' }, fetchImpl,
  })).resolves.toEqual([]);

  expect(requestMethods).toEqual(['GET']);
  expect(fetchImpl.mock.calls[0][0].toString()).toContain('/calendar/v3/calendars/team%2Fcalendar/events');
});

test('discovers Google calendars with only the primary source selected by default', async () => {
  const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.method).toBe('GET');
    return new Response(JSON.stringify({ items: [
      { id: 'work@example.com', summary: 'İş', backgroundColor: '#0b57d0' },
      { id: 'primary', summary: 'Kişisel', primary: true, timeZone: 'Europe/Istanbul' },
    ] }), { status: 200 });
  });

  await expect(listGoogleCalendars({ accessToken: 'server-token', fetchImpl })).resolves.toEqual([
    { id: 'work@example.com', name: 'İş', description: null, timeZone: null, color: '#0b57d0', isSelected: false },
    { id: 'primary', name: 'Kişisel', description: null, timeZone: 'Europe/Istanbul', color: null, isSelected: true },
  ]);
  expect(fetchImpl.mock.calls[0][0].toString()).toContain('/calendar/v3/users/me/calendarList');
});

test('exhausts Google event pages with GET requests', async () => {
  const requestMethods: string[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    requestMethods.push(init?.method ?? 'GET');
    const pageToken = new URL(url.toString()).searchParams.get('pageToken');
    return new Response(JSON.stringify(pageToken ? { items: [{ id: 'g-2', status: 'confirmed' }] } : {
      items: [{ id: 'g-1', status: 'confirmed' }], nextPageToken: 'page-2',
    }), { status: 200 });
  });

  const events = await listGoogleEvents({ calendarId: 'primary', accessToken: 'server-token', range: { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' }, fetchImpl });

  expect(events.map((event) => event.id)).toEqual(['g-1', 'g-2']);
  expect(requestMethods).toEqual(['GET', 'GET']);
});
