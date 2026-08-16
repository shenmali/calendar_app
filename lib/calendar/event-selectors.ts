import type { CalendarDisplayEvent, DateRange } from '@/lib/calendar/types';

export type EventFilters = {
  year: number;
  range?: DateRange;
  connectionIds?: string[];
  sourceCalendarIds?: string[];
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function eventDateInIstanbul(event: Pick<CalendarDisplayEvent, 'startsAt' | 'isAllDay'>): string {
  if (event.isAllDay && /^\d{4}-\d{2}-\d{2}$/.test(event.startsAt)) return event.startsAt;

  const instant = new Date(event.startsAt);
  if (Number.isNaN(instant.getTime())) throw new Error('Expected an ISO calendar event start');
  const parts = dateFormatter.formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) throw new Error('Expected Europe/Istanbul date parts');
  return `${year}-${month}-${day}`;
}

export function selectEvents(events: CalendarDisplayEvent[], filters: EventFilters): CalendarDisplayEvent[] {
  const connectionIds = filters.connectionIds ? new Set(filters.connectionIds) : null;
  const sourceCalendarIds = filters.sourceCalendarIds ? new Set(filters.sourceCalendarIds) : null;
  const yearPrefix = `${filters.year}-`;

  return events.filter((event) => {
    const date = eventDateInIstanbul(event);
    if (!date.startsWith(yearPrefix)) return false;
    if (filters.range && (date < filters.range.start || date >= filters.range.end)) return false;
    if (connectionIds && !connectionIds.has(event.connectionId)) return false;
    if (sourceCalendarIds && !sourceCalendarIds.has(event.sourceCalendarId)) return false;
    return event.status === 'confirmed';
  });
}

export function groupEventsByDay(events: CalendarDisplayEvent[]): Map<string, CalendarDisplayEvent[]> {
  const byDay = new Map<string, CalendarDisplayEvent[]>();
  for (const event of events) {
    const date = eventDateInIstanbul(event);
    const dayEvents = byDay.get(date);
    if (dayEvents) dayEvents.push(event);
    else byDay.set(date, [event]);
  }
  for (const dayEvents of byDay.values()) {
    dayEvents.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  }
  return byDay;
}

export function eventsForDay<T>(events: T[]): { visible: T[]; remaining: number } {
  return { visible: events.slice(0, 2), remaining: Math.max(events.length - 2, 0) };
}
