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
    finishRun: async (_id, values) => { writes.push({ type: 'finish', value: values }); },
    upsertEvent: async (event, sourceId) => { writes.push({ type: 'event', value: { event, sourceId } }); return 'imported'; },
    cancelMissing: async (_connectionId, _sourceId, remoteIds) => { writes.push({ type: 'missing', value: remoteIds }); return 1; },
    updateTokens: async () => { throw new Error('token refresh was not expected'); },
    markConnectionSynced: async () => undefined,
  };
  const sync = createSyncConnection({
    store,
    decrypt: () => 'access-token',
    now: () => new Date('2026-08-15T12:00:00.000Z'),
    providers: {
      google: { listEvents: async () => [{ id: 'g-42', etag: 'v1', status: 'confirmed', payload: { id: 'g-42' } }], normalizeEvent: (_remote, context) => ({
        id: 'google:g-42', connectionId: context.connection.id, sourceCalendarId: context.calendarId, provider: 'google', remoteEventId: 'g-42', remoteVersion: 'v1', title: 'Event', description: null, location: null,
        startsAt: '2026-08-15T10:00:00.000Z', endsAt: '2026-08-15T11:00:00.000Z', isAllDay: false, recurrenceRule: null, status: 'confirmed', updatedAt: '2026-08-15T10:00:00.000Z', lastSyncedAt: context.syncedAt,
      }) },
      microsoft: { listEvents: async () => [], normalizeEvent: () => { throw new Error('not used'); } },
    },
  });

  await expect(sync('connection-1', { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' })).resolves.toMatchObject({ imported: 1, updated: 0, removed: 1 });
  expect(writes).toContainEqual({ type: 'missing', value: ['g-42'] });
  expect(writes).toContainEqual({ type: 'finish', value: expect.objectContaining({ status: 'success' }) });
});

test('marks a sync run failed when the provider read fails', async () => {
  const finishes: unknown[] = [];
  const store: SyncStore = {
    loadConnection: async () => connection, listSelectedSources: async () => [{ id: 'source-1', remoteCalendarId: 'primary' }], createRun: async () => 'run-1',
    finishRun: async (_id, values) => { finishes.push(values); }, upsertEvent: async () => 'updated', cancelMissing: async () => 0, updateTokens: async () => undefined, markConnectionSynced: async () => undefined,
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
