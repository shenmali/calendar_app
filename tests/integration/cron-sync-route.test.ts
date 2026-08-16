import { NextRequest } from 'next/server';
import { expect, test } from 'vitest';

import { createCronSyncHandler } from '@/lib/providers/sync-handlers';

test('rejects an absent or invalid cron authorization without discovering connections', async () => {
  let discovered = false;
  const handler = createCronSyncHandler({
    cronSecret: 'cron-secret',
    listActiveConnections: async () => { discovered = true; return []; },
    synchronizeUser: async () => ({ status: 'completed', summary: { connections: { attempted: 0, succeeded: 0, failed: 0 }, events: { imported: 0, updated: 0, removed: 0 } } }),
  });

  const response = await handler(new NextRequest('https://calendar.example.com/api/cron/sync'));

  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ error: 'Unauthorized' });
  expect(discovered).toBe(false);
});

test('isolates cron failures so another user connection still synchronizes', async () => {
  const synced: string[] = [];
  const handler = createCronSyncHandler({
    cronSecret: 'cron-secret',
    listActiveConnections: async () => [
      { id: 'connection-1', userId: 'user-1' },
      { id: 'connection-2', userId: 'user-2' },
    ],
    synchronizeUser: async (userId) => {
      synced.push(userId);
      if (userId === 'user-1') throw new Error('provider unavailable');
      return { status: 'completed' as const, summary: { connections: { attempted: 1, succeeded: 1, failed: 0 }, events: { imported: 1, updated: 2, removed: 3 } } };
    },
  });

  const response = await handler(new NextRequest('https://calendar.example.com/api/cron/sync', {
    headers: { authorization: 'Bearer cron-secret' },
  }));

  expect(response.status).toBe(200);
  expect(synced).toEqual(['user-1', 'user-2']);
  expect(await response.json()).toEqual({
    users: { attempted: 2, skippedLocked: 0 },
    connections: { attempted: 2, succeeded: 1, failed: 1 },
    events: { imported: 1, updated: 2, removed: 3 },
  });
});
