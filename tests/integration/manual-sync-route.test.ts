import { NextRequest } from 'next/server';
import { expect, test } from 'vitest';

import { createManualSyncHandler } from '@/lib/providers/sync-handlers';

test('returns 409 instead of starting a second manual sync for the same user', async () => {
  const handler = createManualSyncHandler({
    currentUserId: async () => 'user-1',
    listActiveConnections: async () => [{ id: 'connection-1', userId: 'user-1' }],
    synchronizeUser: async () => ({ status: 'locked', summary: { connections: { attempted: 0, succeeded: 0, failed: 0 }, events: { imported: 0, updated: 0, removed: 0 } } }),
  });

  const response = await handler(new NextRequest('https://calendar.example.com/api/sync', { method: 'POST' }));

  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: 'Sync already in progress' });
});

test('returns an accepted sanitized summary for the authenticated user only', async () => {
  const listedFor: string[] = [];
  const handler = createManualSyncHandler({
    currentUserId: async () => 'user-1',
    listActiveConnections: async (userId) => {
      listedFor.push(userId!);
      return [{ id: 'connection-1', userId: 'user-1' }];
    },
    synchronizeUser: async () => ({
      status: 'completed',
      summary: { connections: { attempted: 1, succeeded: 1, failed: 0 }, events: { imported: 2, updated: 3, removed: 4 } },
    }),
  });

  const response = await handler(new NextRequest('https://calendar.example.com/api/sync', { method: 'POST' }));

  expect(response.status).toBe(202);
  expect(listedFor).toEqual(['user-1']);
  expect(await response.json()).toEqual({
    summary: { connections: { attempted: 1, succeeded: 1, failed: 0 }, events: { imported: 2, updated: 3, removed: 4 } },
  });
});
