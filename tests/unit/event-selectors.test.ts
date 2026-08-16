import { expect, test } from 'vitest';

import { eventsForDay, selectEvents } from '@/lib/calendar/event-selectors';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

const baseEvent: CalendarDisplayEvent = {
  id: 'event-1',
  connectionId: 'google-connection',
  sourceId: 'source-work',
  sourceCalendarId: 'work',
  provider: 'google',
  title: 'Planlama',
  description: null,
  location: null,
  startsAt: '2026-01-15T09:00:00.000Z',
  endsAt: '2026-01-15T10:00:00.000Z',
  isAllDay: false,
  status: 'confirmed',
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
    { ...baseEvent, id: 'event-2', connectionId: 'microsoft-connection', sourceId: 'source-home', sourceCalendarId: 'home', startsAt: '2026-06-04T08:00:00.000Z' },
    { ...baseEvent, id: 'event-3', startsAt: '2027-01-15T09:00:00.000Z' },
  ];

  expect(selectEvents(events, {
    year: 2026,
    range: { start: '2026-01-01', end: '2026-03-01' },
    connectionIds: ['google-connection'],
    sourceIds: ['source-work'],
  }).map((event) => event.id)).toEqual(['event-1']);
});

test('shows no events when every source filter is cleared', () => {
  expect(selectEvents([baseEvent], {
    year: 2026,
    sourceIds: [],
  })).toEqual([]);
});

test('keeps sources with the same remote calendar id independently filterable', () => {
  const duplicateRemoteId = { ...baseEvent, id: 'event-2', sourceId: 'source-personal', connectionId: 'microsoft-connection' };

  expect(selectEvents([baseEvent, duplicateRemoteId], {
    year: 2026,
    sourceIds: ['source-personal'],
  }).map((event) => event.id)).toEqual(['event-2']);
});
