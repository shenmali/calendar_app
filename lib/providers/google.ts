import { isoDate, isoInstant, rangeToIsoInstants } from '@/lib/calendar/time';
import type { CalendarEventCancellation, NormalizeContext, NormalizedCalendarEvent, RemoteCalendar, RemoteEvent } from '@/lib/calendar/types';
import type { CalendarProviderClient } from '@/lib/providers/types';

type Fetch = typeof fetch;
type GoogleDate = { date?: string; dateTime?: string; timeZone?: string };
type GoogleEvent = {
  id?: string; etag?: string; status?: string; summary?: string; description?: string; location?: string;
  start?: GoogleDate; end?: GoogleDate; updated?: string; recurrence?: string[]; recurringEventId?: string; originalStartTime?: GoogleDate;
};
type GoogleCalendar = {
  id?: string; summary?: string; description?: string; timeZone?: string; backgroundColor?: string; primary?: boolean;
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

export function normalizeGoogleEvent(input: GoogleEvent | RemoteEvent, context: NormalizeContext): NormalizedCalendarEvent {
  const event = eventPayload(input);
  const metadata = remoteMetadata(input, event);
  const id = requireString(metadata.id, 'id');
  const start = event.start;
  const end = event.end;
  const syncedAt = context.syncedAt;
  if (!start || !end) {
    if (metadata.status === 'cancelled') {
      const cancellation: CalendarEventCancellation = {
        kind: 'cancellation', connectionId: context.connection.id, sourceCalendarId: context.calendarId, provider: 'google',
        remoteEventId: id, remoteVersion: metadata.version ?? null, lastSyncedAt: syncedAt, providerPayload: event,
      };
      return cancellation;
    }
    throw new Error('Google event is missing start or end');
  }
  const isAllDay = Boolean(start.date);
  if (isAllDay !== Boolean(end.date)) throw new Error('Google event has mismatched date boundaries');

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
    remoteSeriesId: event.recurringEventId ?? null,
    remoteOriginalStart: event.originalStartTime?.date ?? event.originalStartTime?.dateTime ?? null,
    providerPayload: event,
    status: metadata.status === 'cancelled' ? 'cancelled' : 'confirmed',
    updatedAt: event.updated ? isoInstant(event.updated) : syncedAt,
    lastSyncedAt: syncedAt,
  };
}

export async function listGoogleEvents({
  calendarId, accessToken, range, fetchImpl = fetch,
}: { calendarId: string; accessToken: string; range: import('@/lib/calendar/types').DateRange; fetchImpl?: Fetch }): Promise<RemoteEvent[]> {
  const normalizedRange = rangeToIsoInstants(range);
  const events: RemoteEvent[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  do {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    const query: Record<string, string> = { timeMin: normalizedRange.start, timeMax: normalizedRange.end, singleEvents: 'true', showDeleted: 'true' };
    if (pageToken) query.pageToken = pageToken;
    url.search = new URLSearchParams(query).toString();
    const response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Google event listing failed (${response.status})`);
    const payload = await response.json() as { items?: unknown; nextPageToken?: unknown };
    if (Array.isArray(payload.items)) {
      events.push(...payload.items.map((item) => {
        const event = item as GoogleEvent;
        return { id: requireString(event.id, 'id'), etag: event.etag ?? null, status: event.status ?? 'confirmed', payload: event };
      }));
    }
    pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken ? payload.nextPageToken : undefined;
    if (pageToken && seenTokens.has(pageToken)) throw new Error('Google event listing returned a repeated page token');
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);
  return events;
}

/** Lists Google calendar containers with GET requests only. */
export async function listGoogleCalendars({ accessToken, fetchImpl = fetch }: { accessToken: string; fetchImpl?: Fetch }): Promise<RemoteCalendar[]> {
  const calendars: RemoteCalendar[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;
  do {
    const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetchImpl(url, { method: 'GET', headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    if (!response.ok) throw new Error(`Google calendar listing failed (${response.status})`);
    const payload = await response.json() as { items?: unknown; nextPageToken?: unknown };
    if (Array.isArray(payload.items)) {
      for (const item of payload.items) {
        const calendar = item as GoogleCalendar;
        if (!calendar.id) continue;
        calendars.push({
          id: calendar.id,
          name: calendar.summary || calendar.id,
          description: calendar.description ?? null,
          timeZone: calendar.timeZone ?? null,
          color: calendar.backgroundColor ?? null,
          isSelected: calendar.primary === true,
        });
      }
    }
    pageToken = typeof payload.nextPageToken === 'string' && payload.nextPageToken ? payload.nextPageToken : undefined;
    if (pageToken && seenTokens.has(pageToken)) throw new Error('Google calendar listing returned a repeated page token');
    if (pageToken) seenTokens.add(pageToken);
  } while (pageToken);
  if (!calendars.length) throw new Error('Google calendar listing returned no calendars');
  if (!calendars.some((calendar) => calendar.isSelected)) calendars[0].isSelected = true;
  return calendars;
}

export const googleCalendarProvider: CalendarProviderClient = {
  listCalendars: ({ accessToken }) => listGoogleCalendars({ accessToken }),
  listEvents: (input) => listGoogleEvents(input),
  normalizeEvent: normalizeGoogleEvent,
};
