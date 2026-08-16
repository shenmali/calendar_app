export type CalendarProvider = 'google' | 'microsoft';

export interface DateRange {
  start: string;
  end: string;
}

export interface CalendarEvent {
  id: string;
  connectionId: string;
  sourceCalendarId: string;
  provider: CalendarProvider;
  remoteEventId: string;
  remoteVersion: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  recurrenceRule: string | null;
  remoteSeriesId: string | null;
  remoteOriginalStart: string | null;
  providerPayload: unknown;
  status: 'confirmed' | 'cancelled';
  updatedAt: string;
  lastSyncedAt: string;
}

/** The small, token-free event shape permitted to cross the server/client boundary. */
export type CalendarDisplayEvent = Pick<
  CalendarEvent,
  'id' | 'connectionId' | 'sourceCalendarId' | 'provider' | 'title' | 'description' | 'location' | 'startsAt' | 'endsAt' | 'isAllDay' | 'status'
> & {
  sourceId: string;
  sourceName?: string;
  sourceColor?: string | null;
};

/** A provider cancellation that has no dates must not overwrite the stored event. */
export interface CalendarEventCancellation {
  kind: 'cancellation';
  connectionId: string;
  sourceCalendarId: string;
  provider: CalendarProvider;
  remoteEventId: string;
  remoteVersion: string | null;
  lastSyncedAt: string;
  providerPayload: unknown;
}

export type NormalizedCalendarEvent = CalendarEvent | CalendarEventCancellation;

export interface SyncResult {
  connectionId: string;
  imported: number;
  updated: number;
  removed: number;
  completedAt: string;
}

/** This form deliberately contains ciphertext only; decrypted tokens never leave server code. */
export interface CalendarConnection {
  id: string;
  userId: string;
  provider: CalendarProvider;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
  tokenExpiresAt?: string | null;
}

export interface RemoteCalendar {
  id: string;
  name: string;
  isSelected: boolean;
}

export interface RemoteEvent {
  id: string;
  etag: string | null;
  status: string;
  payload: unknown;
}

export interface NormalizeContext {
  connection: CalendarConnection;
  calendarId: string;
  syncedAt: string;
}

export interface ListEventsInput {
  connection: CalendarConnection;
  calendarId: string;
  range: DateRange;
  /** Available only in the server-side synchronization boundary. */
  accessToken: string;
}
