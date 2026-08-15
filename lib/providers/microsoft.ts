import { isoDate, isoInstant, rangeToIsoInstants } from '@/lib/calendar/time';
import type { CalendarEvent, NormalizeContext, RemoteEvent } from '@/lib/calendar/types';
import type { CalendarProviderClient } from '@/lib/providers/types';

type Fetch = typeof fetch;
type MicrosoftDateTime = { dateTime?: string; timeZone?: string };
type MicrosoftEvent = {
  id?: string; changeKey?: string; subject?: string; bodyPreview?: string; location?: { displayName?: string };
  isCancelled?: boolean; isAllDay?: boolean; start?: MicrosoftDateTime; end?: MicrosoftDateTime;
  lastModifiedDateTime?: string; recurrence?: { pattern?: { type?: string; interval?: number; daysOfWeek?: string[]; dayOfMonth?: number; month?: number; index?: string }; range?: { type?: string; startDate?: string; endDate?: string; numberOfOccurrences?: number } };
};

const weekday: Record<string, string> = { sunday: 'SU', monday: 'MO', tuesday: 'TU', wednesday: 'WE', thursday: 'TH', friday: 'FR', saturday: 'SA' };
const bySetPosition: Record<string, string> = { first: '1', second: '2', third: '3', fourth: '4', last: '-1' };

function eventPayload(input: MicrosoftEvent | RemoteEvent): MicrosoftEvent {
  return 'payload' in input ? input.payload as MicrosoftEvent : input;
}

function requireString(value: string | undefined, field: string): string {
  if (!value) throw new Error(`Microsoft event is missing ${field}`);
  return value;
}

function rrule(event: MicrosoftEvent): string | null {
  const recurrence = event.recurrence;
  if (!recurrence?.pattern?.type) return null;
  const pattern = recurrence.pattern;
  const patternType = pattern.type;
  if (!patternType) return null;
  const frequencies: Record<string, string> = {
    daily: 'DAILY', weekly: 'WEEKLY', absoluteMonthly: 'MONTHLY', relativeMonthly: 'MONTHLY', absoluteYearly: 'YEARLY', relativeYearly: 'YEARLY',
  };
  const frequency = frequencies[patternType];
  if (!frequency) return null;
  const parts = [`FREQ=${frequency}`, `INTERVAL=${pattern.interval ?? 1}`];
  const days = pattern.daysOfWeek?.map((day) => weekday[day.toLowerCase()]).filter((day): day is string => Boolean(day));
  if (days?.length) parts.push(`BYDAY=${days.join(',')}`);
  if (pattern.dayOfMonth) parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`);
  if (pattern.month) parts.push(`BYMONTH=${pattern.month}`);
  if (pattern.index && bySetPosition[pattern.index]) parts.push(`BYSETPOS=${bySetPosition[pattern.index]}`);
  if (recurrence.range?.type === 'endDate' && recurrence.range.endDate) parts.push(`UNTIL=${isoDate(recurrence.range.endDate).replaceAll('-', '')}T235959Z`);
  if (recurrence.range?.type === 'numbered' && recurrence.range.numberOfOccurrences) parts.push(`COUNT=${recurrence.range.numberOfOccurrences}`);
  return `RRULE:${parts.join(';')}`;
}

export function normalizeMicrosoftEvent(input: MicrosoftEvent | RemoteEvent, context: NormalizeContext): CalendarEvent {
  const event = eventPayload(input);
  const id = requireString('payload' in input ? input.id : event.id, 'id');
  const start = event.start;
  const end = event.end;
  if (!start || !end) throw new Error('Microsoft event is missing start or end');
  const isAllDay = event.isAllDay === true;
  const syncedAt = context.syncedAt;

  return {
    id: `microsoft:${context.connection.id}:${context.calendarId}:${id}`,
    connectionId: context.connection.id, sourceCalendarId: context.calendarId, provider: 'microsoft', remoteEventId: id,
    remoteVersion: ('payload' in input ? input.etag : event.changeKey) ?? null,
    title: event.subject ?? '', description: event.bodyPreview ?? null, location: event.location?.displayName ?? null,
    startsAt: isAllDay ? isoDate(requireString(start.dateTime, 'start.dateTime').slice(0, 10)) : isoInstant(requireString(start.dateTime, 'start.dateTime'), start.timeZone),
    endsAt: isAllDay ? isoDate(requireString(end.dateTime, 'end.dateTime').slice(0, 10)) : isoInstant(requireString(end.dateTime, 'end.dateTime'), end.timeZone),
    isAllDay, recurrenceRule: rrule(event), status: event.isCancelled === true || ('payload' in input && input.status === 'cancelled') ? 'cancelled' : 'confirmed',
    updatedAt: event.lastModifiedDateTime ? isoInstant(event.lastModifiedDateTime) : syncedAt, lastSyncedAt: syncedAt,
  };
}

export async function listMicrosoftEvents({
  calendarId, accessToken, range, fetchImpl = fetch,
}: { calendarId: string; accessToken: string; range: import('@/lib/calendar/types').DateRange; fetchImpl?: Fetch }): Promise<RemoteEvent[]> {
  const normalizedRange = rangeToIsoInstants(range);
  const url = new URL(`https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView`);
  url.search = new URLSearchParams({ startDateTime: normalizedRange.start, endDateTime: normalizedRange.end }).toString();
  const response = await fetchImpl(url, {
    method: 'GET', headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' }, cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Microsoft event listing failed (${response.status})`);
  const payload = await response.json() as { value?: unknown };
  if (!Array.isArray(payload.value)) return [];
  return payload.value.map((item) => {
    const event = item as MicrosoftEvent;
    return { id: requireString(event.id, 'id'), etag: event.changeKey ?? null, status: event.isCancelled ? 'cancelled' : 'confirmed', payload: event };
  });
}

export const microsoftCalendarProvider: CalendarProviderClient = {
  listEvents: (input) => listMicrosoftEvents(input),
  normalizeEvent: normalizeMicrosoftEvent,
};
