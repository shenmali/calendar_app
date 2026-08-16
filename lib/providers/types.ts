export const oauthProviders = ['google', 'microsoft'] as const;

export type OAuthProvider = (typeof oauthProviders)[number];

export type { CalendarConnection, CalendarEvent, CalendarEventCancellation, DateRange, ListEventsInput, NormalizeContext, NormalizedCalendarEvent, RemoteCalendar, RemoteEvent } from '@/lib/calendar/types';
import type { ListEventsInput, NormalizeContext, NormalizedCalendarEvent, RemoteEvent } from '@/lib/calendar/types';

export type ProviderConnection = {
  id: string;
  provider: OAuthProvider;
  providerAccountId: string;
  scopes: string[];
  tokenExpiresAt: string | null;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return oauthProviders.includes(value as OAuthProvider);
}

export interface CalendarProviderClient {
  listEvents(input: ListEventsInput): Promise<RemoteEvent[]>;
  normalizeEvent(input: RemoteEvent, context: NormalizeContext): NormalizedCalendarEvent;
}

export const providerScopes: Record<OAuthProvider, string[]> = {
  google: ['https://www.googleapis.com/auth/calendar.readonly'],
  microsoft: ['openid', 'profile', 'email', 'offline_access', 'https://graph.microsoft.com/Calendars.Read'],
};

export const providerAuthorizationEndpoints: Record<OAuthProvider, string> = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
  microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
};

export const providerTokenEndpoints: Record<OAuthProvider, string> = {
  google: 'https://oauth2.googleapis.com/token',
  microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
};
