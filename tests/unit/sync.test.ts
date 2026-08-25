import { expect, test } from 'vitest';

import { createSyncConnection, type SyncStore } from '@/lib/providers/sync';

const connection = {
  id: 'connection-1', userId: 'user-1', provider: 'google' as const,
  encryptedAccessToken: 'encrypted-access', encryptedRefreshToken: null, tokenExpiresAt: null,
};

test('syncs selected sources, completes its run, and cancels events missing remotely', async () => {
  const writes: Array<{ type: string; value?: unknown }> = [];
  const store: SyncStore = {
    loadConnection: async () => connection,
    listSelectedSources: async () => [{ id: 'source-1', remoteCalendarId: 'primary' }],
    createRun: async () => 'run-1',
    finishRun: async (_connection, _id, values) => { writes.push({ type: 'finish', value: values }); },
    upsertEvent: async (event, sourceId) => { writes.push({ type: 'event', value: { event, sourceId } }); return 'imported'; },
    cancelMissing: async (_connection, _sourceId, remoteIds, range) => { writes.push({ type: 'missing', value: { remoteIds, range } }); return 1; },
    cancelRemoteEvent: async () => false,
    updateTokens: async () => { throw new Error('token refresh was not expected'); },
    markConnectionSynced: async () => undefined,
  };
  const sync = createSyncConnection({
    store,
    decrypt: () => 'access-token',
    now: () => new Date('2026-08-15T12:00:00.000Z'),
    providers: {
      google: { listEvents: async () => [{ id: 'g-42', etag: 'v1', status: 'confirmed', payload: { id: 'g-42' } }, { id: 'g-43', etag: 'v1', status: 'confirmed', payload: { id: 'g-43' } }], normalizeEvent: (remote, context) => ({
        id: `google:${remote.id}`, connectionId: context.connection.id, sourceCalendarId: context.calendarId, provider: 'google', remoteEventId: remote.id, remoteVersion: 'v1', title: 'Event', description: null, location: null,
        startsAt: '2026-08-15T10:00:00.000Z', endsAt: '2026-08-15T11:00:00.000Z', isAllDay: false, recurrenceRule: null, remoteSeriesId: null, remoteOriginalStart: null, providerPayload: { id: remote.id }, status: 'confirmed', updatedAt: '2026-08-15T10:00:00.000Z', lastSyncedAt: context.syncedAt,
      }) },
      microsoft: { listEvents: async () => [], normalizeEvent: () => { throw new Error('not used'); } },
    },
  });

  await expect(sync('connection-1', { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' })).resolves.toMatchObject({ imported: 2, updated: 0, removed: 1 });
  expect(writes).toContainEqual({ type: 'missing', value: { remoteIds: ['g-42', 'g-43'], range: { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' } } });
  expect(writes).toContainEqual({ type: 'finish', value: expect.objectContaining({ status: 'success' }) });
});

test('discovers and selects the primary calendar before the first sync when a legacy connection has no sources', async () => {
  let sources: Array<{ id: string; remoteCalendarId: string }> = [];
  const initialized = [] as unknown[];
  const store = {
    loadConnection: async () => connection,
    listSelectedSources: async () => sources,
    initializeSources: async (_connection: unknown, calendars: unknown[]) => {
      initialized.push(calendars);
      sources = [{ id: 'source-primary', remoteCalendarId: 'primary' }];
    },
    createRun: async () => 'run-1',
    finishRun: async () => undefined,
    upsertEvent: async () => 'imported' as const,
    cancelMissing: async () => 0,
    cancelRemoteEvent: async () => false,
    updateTokens: async () => undefined,
    markConnectionSynced: async () => undefined,
  } as unknown as SyncStore;
  const sync = createSyncConnection({
    store,
    decrypt: () => 'access-token',
    providers: {
      google: {
        listCalendars: async () => [{ id: 'primary', name: 'Kişisel', isSelected: true }],
        listEvents: async () => [{ id: 'g-1', etag: 'v1', status: 'confirmed', payload: { id: 'g-1' } }],
        normalizeEvent: (remote: { id: string }, context: { connection: typeof connection; calendarId: string; syncedAt: string }) => ({
          id: `google:${remote.id}`, connectionId: context.connection.id, sourceCalendarId: context.calendarId, provider: 'google' as const,
          remoteEventId: remote.id, remoteVersion: 'v1', title: 'Etkinlik', description: null, location: null,
          startsAt: '2026-08-15T10:00:00.000Z', endsAt: '2026-08-15T11:00:00.000Z', isAllDay: false,
          recurrenceRule: null, remoteSeriesId: null, remoteOriginalStart: null, providerPayload: {}, status: 'confirmed' as const,
          updatedAt: '2026-08-15T10:00:00.000Z', lastSyncedAt: context.syncedAt,
        }),
      },
      microsoft: { listEvents: async () => [], normalizeEvent: () => { throw new Error('not used'); } },
    } as never,
  });

  await expect(sync('connection-1', { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' }))
    .resolves.toMatchObject({ imported: 1 });
  expect(initialized).toEqual([[{ id: 'primary', name: 'Kişisel', isSelected: true }]]);
});

test('marks a sync run failed when the provider read fails', async () => {
  const finishes: unknown[] = [];
  const store: SyncStore = {
    loadConnection: async () => connection, listSelectedSources: async () => [{ id: 'source-1', remoteCalendarId: 'primary' }], createRun: async () => 'run-1',
    finishRun: async (_connection, _id, values) => { finishes.push(values); }, upsertEvent: async () => 'updated', cancelMissing: async () => 0, cancelRemoteEvent: async () => false, updateTokens: async () => undefined, markConnectionSynced: async () => undefined,
  };
  const sync = createSyncConnection({
    store, decrypt: () => 'access-token', now: () => new Date('2026-08-15T12:00:00.000Z'),
    providers: {
      google: { listEvents: async () => { throw new Error('provider unavailable'); }, normalizeEvent: () => { throw new Error('not used'); } },
      microsoft: { listEvents: async () => [], normalizeEvent: () => { throw new Error('not used'); } },
    },
  });

  await expect(sync('connection-1', { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' })).rejects.toThrow('provider unavailable');
  expect(finishes).toEqual([expect.objectContaining({ status: 'failed', errorMessage: 'provider unavailable' })]);
});

test('applies an id-only cancellation without overwriting the local event dates', async () => {
  const cancellations: unknown[] = [];
  const store: SyncStore = {
    loadConnection: async () => connection, listSelectedSources: async () => [{ id: 'source-1', remoteCalendarId: 'primary' }], createRun: async () => 'run-1',
    finishRun: async () => undefined, upsertEvent: async () => 'updated', cancelMissing: async () => 0, updateTokens: async () => undefined, markConnectionSynced: async () => undefined,
    cancelRemoteEvent: async (...args) => { cancellations.push(args); return true; },
  };
  const sync = createSyncConnection({
    store, decrypt: () => 'access-token', now: () => new Date('2026-08-15T12:00:00.000Z'),
    providers: {
      google: { listEvents: async () => [{ id: 'g-tombstone', etag: 'v2', status: 'cancelled', payload: { id: 'g-tombstone' } }], normalizeEvent: (_event, context) => ({ kind: 'cancellation', connectionId: context.connection.id, sourceCalendarId: context.calendarId, provider: 'google', remoteEventId: 'g-tombstone', remoteVersion: 'v2', lastSyncedAt: context.syncedAt, providerPayload: { id: 'g-tombstone' } }) },
      microsoft: { listEvents: async () => [], normalizeEvent: () => { throw new Error('not used'); } },
    },
  });

  await expect(sync('connection-1', { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' })).resolves.toMatchObject({ updated: 1 });
  expect(cancellations).toHaveLength(1);
  expect(cancellations[0]).toEqual([connection, 'source-1', expect.objectContaining({ remoteEventId: 'g-tombstone' })]);
});
