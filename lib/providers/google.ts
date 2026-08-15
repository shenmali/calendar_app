import { isoDate, isoInstant, rangeToIsoInstants } from '@/lib/calendar/time';
import type { CalendarEvent, NormalizeContext, RemoteEvent } from '@/lib/calendar/types';
import type { CalendarProviderClient } from '@/lib/providers/types';

type Fetch = typeof fetch;
type GoogleDate = { date?: string; dateTime?: string; timeZone?: string };
type GoogleEvent = {
  id?: string; etag?: string; status?: string; summary?: string; description?: string; location?: string;
  start?: GoogleDate; end?: GoogleDate; updated?: string; recurrence?: string[];
};

function eventPayload(input: GoogleEvent | RemoteEvent): GoogleEvent {
  return 'payload' in input ? input.payload as GoogleEvent : input;
}

function remoteMetadata(input: GoogleEvent | RemoteEvent, event: GoogleEvent) {
  return {
    id: 'payload' in input ? input.id : event.id,
    version: 'payload' in input ? input.etag : event.etag,
    status: 'payload' in input ? input.status : event.status,
  };
}

function requireString(value: string | undefined, field: string): string {
  if (!value) throw new Error(`Google event is missing ${field}`);
  return value;
}

export function normalizeGoogleEvent(input: GoogleEvent | RemoteEvent, context: NormalizeContext): CalendarEvent {
  const event = eventPayload(input);
  const metadata = remoteMetadata(input, event);
  const id = requireString(metadata.id, 'id');
  const start = event.start;
  const end = event.end;
  if (!start || !end) throw new Error('Google event is missing start or end');
  const isAllDay = Boolean(start.date);
  if (isAllDay !== Boolean(end.date)) throw new Error('Google event has mismatched date boundaries');
  const syncedAt = context.syncedAt;

  return {
    id: `google:${context.connection.id}:${context.calendarId}:${id}`,
    connectionId: context.connection.id,
    sourceCalendarId: context.calendarId,
    provider: 'google',
    remoteEventId: id,
    remoteVersion: metadata.version ?? null,
    title: event.summary ?? '',
    description: event.description ?? null,
    location: event.location ?? null,
    startsAt: isAllDay ? isoDate(requireString(start.date, 'start.date')) : isoInstant(requireString(start.dateTime, 'start.dateTime'), start.timeZone),
    endsAt: isAllDay ? isoDate(requireString(end.date, 'end.date')) : isoInstant(requireString(end.dateTime, 'end.dateTime'), end.timeZone),
    isAllDay,
    recurrenceRule: event.recurrence?.find((line) => line.startsWith('RRULE:')) ?? null,
    status: metadata.status === 'cancelled' ? 'cancelled' : 'confirmed',
    updatedAt: event.updated ? isoInstant(event.updated) : syncedAt,
    lastSyncedAt: syncedAt,
  };
}

export async function listGoogleEvents({
  calendarId, accessToken, range, fetchImpl = fetch,
}: { calendarId: string; accessToken: string; range: import('@/lib/calendar/types').DateRange; fetchImpl?: Fetch }): Promise<RemoteEvent[]> {
  const normalizedRange = rangeToIsoInstants(range);
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
  url.search = new URLSearchParams({ timeMin: normalizedRange.start, timeMax: normalizedRange.end, singleEvents: 'true', showDeleted: 'true' }).toString();
  const response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Google event listing failed (${response.status})`);
  const payload = await response.json() as { items?: unknown };
  if (!Array.isArray(payload.items)) return [];
  return payload.items.map((item) => {
    const event = item as GoogleEvent;
    return { id: requireString(event.id, 'id'), etag: event.etag ?? null, status: event.status ?? 'confirmed', payload: event };
  });
}

export const googleCalendarProvider: CalendarProviderClient = {
  listEvents: (input) => listGoogleEvents(input),
  normalizeEvent: normalizeGoogleEvent,
};
