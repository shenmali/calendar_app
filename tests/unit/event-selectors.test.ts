import { expect, test } from 'vitest';

import { eventsForDay, selectEvents } from '@/lib/calendar/event-selectors';
import type { CalendarEvent } from '@/lib/calendar/types';

const baseEvent: CalendarEvent = {
  id: 'event-1',
  connectionId: 'google-connection',
  sourceCalendarId: 'work',
  provider: 'google',
  remoteEventId: 'remote-1',
  remoteVersion: null,
  title: 'Planlama',
  description: null,
  location: null,
  startsAt: '2026-01-15T09:00:00.000Z',
  endsAt: '2026-01-15T10:00:00.000Z',
  isAllDay: false,
  recurrenceRule: null,
  remoteSeriesId: null,
  remoteOriginalStart: null,
  providerPayload: null,
  status: 'confirmed',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastSyncedAt: '2026-01-01T00:00:00.000Z',
};

test('shows only the first two events in a day cell and counts the rest', () => {
  const fiveEvents = Array.from({ length: 5 }, (_, index) => ({
    ...baseEvent,
    id: `event-${index + 1}`,
    title: `Etkinlik ${index + 1}`,
  }));

  expect(eventsForDay(fiveEvents)).toEqual({
    visible: fiveEvents.slice(0, 2),
    remaining: 3,
  });
});

test('filters events by year, range, connection, and source calendar', () => {
  const events = [
    baseEvent,
    { ...baseEvent, id: 'event-2', connectionId: 'microsoft-connection', sourceCalendarId: 'home', startsAt: '2026-06-04T08:00:00.000Z' },
    { ...baseEvent, id: 'event-3', startsAt: '2027-01-15T09:00:00.000Z' },
  ];

  expect(selectEvents(events, {
    year: 2026,
    range: { start: '2026-01-01', end: '2026-03-01' },
    connectionIds: ['google-connection'],
    sourceCalendarIds: ['work'],
  }).map((event) => event.id)).toEqual(['event-1']);
});

test('shows no events when every source filter is cleared', () => {
  expect(selectEvents([baseEvent], {
    year: 2026,
    sourceCalendarIds: [],
  })).toEqual([]);
});
