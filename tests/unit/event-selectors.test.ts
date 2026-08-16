import { expect, test } from 'vitest';

import { eventDatesInIstanbul, eventsForDay, groupEventsByDay, selectEvents } from '@/lib/calendar/event-selectors';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

const baseEvent: CalendarDisplayEvent = {
  id: 'event-1', connectionId: 'google-connection', sourceId: 'source-work', sourceCalendarId: 'work', provider: 'google', title: 'Planlama', description: null, location: null,
  startsAt: '2026-01-15T09:00:00.000Z', endsAt: '2026-01-15T10:00:00.000Z', isAllDay: false, status: 'confirmed', sourceIsSelected: true,
};

test('shows only the first two events in a day cell and counts the rest', () => {
  const fiveEvents = Array.from({ length: 5 }, (_, index) => ({ ...baseEvent, id: `event-${index + 1}`, title: `Etkinlik ${index + 1}` }));
  expect(eventsForDay(fiveEvents)).toEqual({ visible: fiveEvents.slice(0, 2), remaining: 3 });
});

test('filters events by year, range, connection, and source calendar', () => {
  const events = [baseEvent, { ...baseEvent, id: 'event-2', connectionId: 'microsoft-connection', sourceId: 'source-home', sourceCalendarId: 'home', startsAt: '2026-06-04T08:00:00.000Z' }, { ...baseEvent, id: 'event-3', startsAt: '2027-01-15T09:00:00.000Z' }];
  expect(selectEvents(events, { year: 2026, range: { start: '2026-01-01', end: '2026-03-01' }, connectionIds: ['google-connection'], sourceIds: ['source-work'] }).map((event) => event.id)).toEqual(['event-1']);
});

test('shows no events when every source filter is cleared', () => {
  expect(selectEvents([baseEvent], { year: 2026, sourceIds: [] })).toEqual([]);
});

test('keeps sources with the same remote calendar id independently filterable', () => {
  const duplicateRemoteId = { ...baseEvent, id: 'event-2', sourceId: 'source-personal', connectionId: 'microsoft-connection' };
  expect(selectEvents([baseEvent, duplicateRemoteId], { year: 2026, sourceIds: ['source-personal'] }).map((event) => event.id)).toEqual(['event-2']);
});

test('groups overnight and all-day events into every Istanbul day they overlap', () => {
  const overnight = { ...baseEvent, id: 'overnight', startsAt: '2026-01-15T20:30:00.000Z', endsAt: '2026-01-16T00:30:00.000Z' };
  const allDay = { ...baseEvent, id: 'all-day', startsAt: '2026-01-15', endsAt: '2026-01-17', isAllDay: true };
  expect(eventDatesInIstanbul(overnight)).toEqual(['2026-01-15', '2026-01-16']);
  expect(eventDatesInIstanbul(allDay)).toEqual(['2026-01-15', '2026-01-16']);
  expect(groupEventsByDay([overnight, allDay]).get('2026-01-16')?.map((event) => event.id)).toEqual(['all-day', 'overnight']);
});

test('uses a half-open Istanbul interval so an event ending at midnight is not shown the next day', () => {
  const midnightEnd = { ...baseEvent, startsAt: '2026-01-15T20:00:00.000Z', endsAt: '2026-01-15T21:00:00.000Z' };
  expect(eventDatesInIstanbul(midnightEnd)).toEqual(['2026-01-15']);
});

test('keeps an adjacent-year event for a visible cross-year week range', () => {
  const newYearsDay = { ...baseEvent, startsAt: '2027-01-01T09:00:00.000Z', endsAt: '2027-01-01T10:00:00.000Z' };
  expect(selectEvents([newYearsDay], { year: 2026, range: { start: '2026-12-28', end: '2027-01-04' }, sourceIds: ['source-work'] }).map((event) => event.id)).toEqual(['event-1']);
});
