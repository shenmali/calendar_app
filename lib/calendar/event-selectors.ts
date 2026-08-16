import type { CalendarDisplayEvent, DateRange } from '@/lib/calendar/types';

export type EventFilters = {
  year?: number;
  range?: DateRange;
  connectionIds?: string[];
  sourceIds?: string[];
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
});

function addDays(date: string, amount: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return value.toISOString().slice(0, 10);
}

function dateForInstant(value: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error('Expected an ISO calendar event instant');
  const parts = dateFormatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  const year = part('year');
  const month = part('month');
  const day = part('day');
  if (!year || !month || !day) throw new Error('Expected Europe/Istanbul date parts');
  return `${year}-${month}-${day}`;
}

export function eventDateInIstanbul(event: Pick<CalendarDisplayEvent, 'startsAt' | 'isAllDay'>): string {
  if (event.isAllDay && /^\d{4}-\d{2}-\d{2}$/.test(event.startsAt)) return event.startsAt;
  return dateForInstant(event.startsAt);
}

/** Returns the Istanbul calendar dates touched by the event's half-open interval. */
export function eventDatesInIstanbul(event: Pick<CalendarDisplayEvent, 'startsAt' | 'endsAt' | 'isAllDay'>): string[] {
  const start = eventDateInIstanbul(event);
  let endExclusive: string;
  if (event.isAllDay) {
    endExclusive = /^\d{4}-\d{2}-\d{2}$/.test(event.endsAt) && event.endsAt > start ? event.endsAt : addDays(start, 1);
  } else {
    const end = new Date(event.endsAt);
    const startsAt = new Date(event.startsAt);
    if (Number.isNaN(end.getTime()) || Number.isNaN(startsAt.getTime())) throw new Error('Expected ISO calendar event interval');
    const inclusiveEnd = end.getTime() > startsAt.getTime() ? dateForInstant(new Date(end.getTime() - 1).toISOString()) : start;
    endExclusive = addDays(inclusiveEnd, 1);
  }

  const dates: string[] = [];
  for (let date = start; date < endExclusive; date = addDays(date, 1)) dates.push(date);
  return dates;
}

function overlapsDateRange(event: CalendarDisplayEvent, range: DateRange): boolean {
  return eventDatesInIstanbul(event).some((date) => date >= range.start && date < range.end);
}

export function selectEvents(events: CalendarDisplayEvent[], filters: EventFilters): CalendarDisplayEvent[] {
  const connectionIds = filters.connectionIds ? new Set(filters.connectionIds) : null;
  const sourceIds = filters.sourceIds ? new Set(filters.sourceIds) : null;
  const range = filters.range ?? (filters.year ? { start: `${filters.year}-01-01`, end: `${filters.year + 1}-01-01` } : undefined);

  return events.filter((event) => {
    if (range && !overlapsDateRange(event, range)) return false;
    if (connectionIds && !connectionIds.has(event.connectionId)) return false;
    if (sourceIds && !sourceIds.has(event.sourceId)) return false;
    return event.status === 'confirmed';
  });
}

export function groupEventsByDay(events: CalendarDisplayEvent[]): Map<string, CalendarDisplayEvent[]> {
  const byDay = new Map<string, CalendarDisplayEvent[]>();
  for (const event of events) {
    for (const date of eventDatesInIstanbul(event)) {
      const dayEvents = byDay.get(date);
      if (dayEvents) dayEvents.push(event);
      else byDay.set(date, [event]);
    }
  }
  for (const dayEvents of byDay.values()) dayEvents.sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  return byDay;
}

export function eventsForDay<T>(events: T[]): { visible: T[]; remaining: number } {
  return { visible: events.slice(0, 2), remaining: Math.max(events.length - 2, 0) };
}
