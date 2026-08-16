import { expect, test } from 'vitest';

import { createSyncCoordinator, withSyncLock, type SyncLockStore } from '@/lib/providers/sync-lock';

const range = { start: '2026-08-15T00:00:00.000Z', end: '2026-08-16T00:00:00.000Z' };

test('releases a user lock when its operation throws', async () => {
  const released: Array<[string, string]> = [];
  const locks: SyncLockStore = {
    acquire: async () => true,
    release: async (userId, ownerId) => { released.push([userId, ownerId]); },
  };

  await expect(withSyncLock({ locks, userId: 'user-1', ownerId: 'owner-1' }, async () => {
    throw new Error('provider unavailable');
  })).rejects.toThrow('provider unavailable');

  expect(released).toEqual([['user-1', 'owner-1']]);
});

test('returns a held result when a user lock is unavailable', async () => {
  const coordinator = createSyncCoordinator({
    locks: { acquire: async () => false, release: async () => undefined },
    syncConnection: async () => { throw new Error('sync must not run'); },
    createLockId: () => 'owner-1',
    range: () => range,
  });

  await expect(coordinator.synchronizeUser('user-1', [{ id: 'connection-1', userId: 'user-1' }]))
    .resolves.toEqual({ status: 'locked', summary: { connections: { attempted: 0, succeeded: 0, failed: 0 }, events: { imported: 0, updated: 0, removed: 0 } } });
});

test('continues a user sync after one connection fails', async () => {
  const calls: string[] = [];
  const coordinator = createSyncCoordinator({
    locks: { acquire: async () => true, release: async () => undefined },
    syncConnection: async (connectionId) => {
      calls.push(connectionId);
      if (connectionId === 'connection-1') throw new Error('provider unavailable');
      return { connectionId, imported: 2, updated: 1, removed: 3, completedAt: '2026-08-15T12:00:00.000Z' };
    },
    createLockId: () => 'owner-1',
    range: () => range,
  });

  await expect(coordinator.synchronizeUser('user-1', [
    { id: 'connection-1', userId: 'user-1' },
    { id: 'connection-2', userId: 'user-1' },
  ])).resolves.toEqual({
    status: 'completed',
    summary: { connections: { attempted: 2, succeeded: 1, failed: 1 }, events: { imported: 2, updated: 1, removed: 3 } },
  });
  expect(calls).toEqual(['connection-1', 'connection-2']);
});
