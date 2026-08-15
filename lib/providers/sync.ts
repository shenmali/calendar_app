import { decryptToken, encryptToken } from '@/lib/security/token-crypto';
import type { CalendarConnection, CalendarEvent, DateRange, SyncResult } from '@/lib/calendar/types';
import { googleCalendarProvider } from '@/lib/providers/google';
import { microsoftCalendarProvider } from '@/lib/providers/microsoft';
import { oauthClientCredentials } from '@/lib/providers/oauth';
import { providerTokenEndpoints, type CalendarProviderClient } from '@/lib/providers/types';

export type SelectedSource = { id: string; remoteCalendarId: string };
export type WriteOutcome = 'imported' | 'updated';

export interface SyncStore {
  loadConnection(connectionId: string): Promise<CalendarConnection | null>;
  listSelectedSources(connectionId: string): Promise<SelectedSource[]>;
  createRun(connection: CalendarConnection, range: DateRange, startedAt: string): Promise<string>;
  finishRun(runId: string, values: { status: 'success' | 'failed'; completedAt: string; errorMessage?: string }): Promise<void>;
  upsertEvent(event: CalendarEvent, sourceId: string): Promise<WriteOutcome>;
  cancelMissing(connectionId: string, sourceId: string, remoteEventIds: string[], syncedAt: string): Promise<number>;
  updateTokens(connection: CalendarConnection, values: { encryptedAccessToken: string; encryptedRefreshToken: string | null; tokenExpiresAt: string | null }): Promise<void>;
  markConnectionSynced(connection: CalendarConnection, syncedAt: string): Promise<void>;
}

type ProviderMap = Record<CalendarConnection['provider'], CalendarProviderClient>;
type Fetch = typeof fetch;

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Calendar synchronization failed';
}

function isoNow(now: () => Date): string {
  return now().toISOString();
}

function isExpired(expiresAt: string | null | undefined, now: Date): boolean {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= now.getTime());
}

type RefreshResponse = { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };

/**
 * The only non-GET provider request in this task is OAuth's server-side token
 * endpoint. It is never callable by a browser and is not a calendar write.
 */
export async function refreshAccessToken(
  connection: CalendarConnection,
  refreshToken: string,
  fetchImpl: Fetch = fetch,
  now: () => Date = () => new Date(),
): Promise<{ accessToken: string; refreshToken: string; expiresAt: string | null }> {
  const credentials = oauthClientCredentials(connection.provider);
  const response = await fetchImpl(providerTokenEndpoints[connection.provider], {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId, client_secret: credentials.clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new Error(`Token refresh failed (${response.status})`);
  const body = await response.json() as RefreshResponse;
  if (typeof body.access_token !== 'string' || !body.access_token) throw new Error('Token refresh returned no access token');
  const expiresAt = typeof body.expires_in === 'number' && Number.isFinite(body.expires_in)
    ? new Date(now().getTime() + body.expires_in * 1000).toISOString()
    : null;
  return { accessToken: body.access_token, refreshToken: typeof body.refresh_token === 'string' && body.refresh_token ? body.refresh_token : refreshToken, expiresAt };
}

export interface SyncDependencies {
  store: SyncStore;
  providers: ProviderMap;
  decrypt: (ciphertext: string) => string;
  encrypt?: (plaintext: string) => string;
  refresh?: (connection: CalendarConnection, refreshToken: string) => Promise<{ accessToken: string; refreshToken: string; expiresAt: string | null }>;
  now?: () => Date;
}

export function createSyncConnection({
  store, providers, decrypt, encrypt = encryptToken, refresh = refreshAccessToken, now = () => new Date(),
}: SyncDependencies): (connectionId: string, range: DateRange) => Promise<SyncResult> {
  return async (connectionId, range) => {
    const connection = await store.loadConnection(connectionId);
    if (!connection) throw new Error('Calendar connection not found');

    const startedAt = isoNow(now);
    const runId = await store.createRun(connection, range, startedAt);
    try {
      let accessToken = decrypt(connection.encryptedAccessToken);
      let effectiveConnection = connection;
      if (isExpired(connection.tokenExpiresAt, now())) {
        if (!connection.encryptedRefreshToken) throw new Error('Calendar connection token has expired');
        const tokens = await refresh(connection, decrypt(connection.encryptedRefreshToken));
        await store.updateTokens(connection, {
          encryptedAccessToken: encrypt(tokens.accessToken), encryptedRefreshToken: encrypt(tokens.refreshToken), tokenExpiresAt: tokens.expiresAt,
        });
        accessToken = tokens.accessToken;
        effectiveConnection = { ...connection, tokenExpiresAt: tokens.expiresAt };
      }

      let imported = 0;
      let updated = 0;
      let removed = 0;
      const syncedAt = isoNow(now);
      const provider = providers[connection.provider];
      for (const source of await store.listSelectedSources(connection.id)) {
        const remoteEvents = await provider.listEvents({ connection: effectiveConnection, calendarId: source.remoteCalendarId, range, accessToken });
        const remoteEventIds: string[] = [];
        for (const remoteEvent of remoteEvents) {
          const event = provider.normalizeEvent(remoteEvent, { connection: effectiveConnection, calendarId: source.remoteCalendarId, syncedAt });
          remoteEventIds.push(event.remoteEventId);
          if (await store.upsertEvent(event, source.id) === 'imported') imported += 1;
          else updated += 1;
        }
        removed += await store.cancelMissing(connection.id, source.id, remoteEventIds, syncedAt);
      }
      const completedAt = isoNow(now);
      await store.markConnectionSynced(connection, completedAt);
      await store.finishRun(runId, { status: 'success', completedAt });
      return { connectionId: connection.id, imported, updated, removed, completedAt };
    } catch (error) {
      await store.finishRun(runId, { status: 'failed', completedAt: isoNow(now), errorMessage: asMessage(error) });
      throw error;
    }
  };
}

function defaultStore(): SyncStore {
  // The privileged client itself is marked `server-only`; dynamic loading also
  // keeps this orchestration module usable in unit tests without credentials.
  const client = async () => (await import('@/lib/supabase/admin')).createAdminClient();
  const ownerByConnection = new Map<string, string>();
  return {
    async loadConnection(connectionId) {
      const { data, error } = await (await client()).from('oauth_connections')
        .select('id, user_id, provider, access_token_ciphertext, refresh_token_ciphertext, token_expires_at')
        .eq('id', connectionId).maybeSingle();
      if (error) throw new Error('Unable to load calendar connection');
      if (!data || (data.provider !== 'google' && data.provider !== 'microsoft')) return null;
      const connection = {
        id: data.id, userId: data.user_id, provider: data.provider,
        encryptedAccessToken: data.access_token_ciphertext, encryptedRefreshToken: data.refresh_token_ciphertext,
        tokenExpiresAt: data.token_expires_at,
      };
      ownerByConnection.set(connection.id, connection.userId);
      return connection;
    },
    async listSelectedSources(connectionId) {
      const { data, error } = await (await client()).from('calendar_sources').select('id, remote_calendar_id')
        .eq('connection_id', connectionId).eq('is_selected', true);
      if (error) throw new Error('Unable to load selected calendars');
      return (data ?? []).map((source) => ({ id: source.id, remoteCalendarId: source.remote_calendar_id }));
    },
    async createRun(connection, range, startedAt) {
      const { data, error } = await (await client()).from('sync_runs').insert({
        user_id: connection.userId, connection_id: connection.id, status: 'running', started_at: startedAt,
        metadata: { range },
      }).select('id').single();
      if (error || !data) throw new Error('Unable to create sync run');
      return data.id;
    },
    async finishRun(runId, values) {
      const { error } = await (await client()).from('sync_runs').update({
        status: values.status, completed_at: values.completedAt, error_message: values.errorMessage ?? null,
      }).eq('id', runId);
      if (error) throw new Error('Unable to complete sync run');
    },
    async upsertEvent(event, sourceId) {
      const userId = ownerByConnection.get(event.connectionId);
      if (!userId) throw new Error('Calendar connection owner is unavailable');
      const table = (await client()).from('calendar_events');
      const { data: existing, error: lookupError } = await table.select('id')
        .eq('connection_id', event.connectionId).eq('source_id', sourceId).eq('remote_event_id', event.remoteEventId).maybeSingle();
      if (lookupError) throw new Error('Unable to look up calendar event');
      const { error } = await table.upsert({
        user_id: userId,
        connection_id: event.connectionId, source_id: sourceId, remote_event_id: event.remoteEventId, remote_version: event.remoteVersion,
        title: event.title, description: event.description, location: event.location, starts_at: event.startsAt, ends_at: event.endsAt,
        is_all_day: event.isAllDay, recurrence_rule: event.recurrenceRule, status: event.status, remote_updated_at: event.updatedAt, last_synced_at: event.lastSyncedAt, sync_state: 'synced',
      }, { onConflict: 'connection_id,remote_event_id' });
      if (error) throw new Error('Unable to upsert calendar event');
      return existing ? 'updated' : 'imported';
    },
    async cancelMissing(connectionId, sourceId, remoteEventIds, syncedAt) {
      const { data, error } = await (await client()).from('calendar_events').select('id, remote_event_id, status')
        .eq('connection_id', connectionId).eq('source_id', sourceId);
      if (error) throw new Error('Unable to load calendar events');
      const missing = (data ?? []).filter((event) => event.status !== 'cancelled' && !remoteEventIds.includes(event.remote_event_id));
      await Promise.all(missing.map(async (event) => {
        const { error: updateError } = await (await client()).from('calendar_events').update({
          status: 'cancelled', sync_state: 'cancelled', last_synced_at: syncedAt,
        }).eq('id', event.id).eq('connection_id', connectionId).eq('source_id', sourceId);
        if (updateError) throw new Error('Unable to cancel missing calendar event');
      }));
      return missing.length;
    },
    async updateTokens(connection, values) {
      const { error } = await (await client()).from('oauth_connections').update({
        access_token_ciphertext: values.encryptedAccessToken, refresh_token_ciphertext: values.encryptedRefreshToken, token_expires_at: values.tokenExpiresAt,
      }).eq('id', connection.id).eq('user_id', connection.userId);
      if (error) throw new Error('Unable to retain refreshed calendar token');
    },
    async markConnectionSynced(connection, syncedAt) {
      const { error } = await (await client()).from('oauth_connections').update({ last_synced_at: syncedAt })
        .eq('id', connection.id).eq('user_id', connection.userId);
      if (error) throw new Error('Unable to update calendar connection sync time');
    },
  };
}

export const syncConnection = createSyncConnection({
  store: defaultStore(),
  providers: { google: googleCalendarProvider, microsoft: microsoftCalendarProvider },
  decrypt: decryptToken,
});
