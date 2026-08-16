import { expect, test } from 'vitest';

import { readManualSyncResult } from '@/lib/calendar/sync-refresh';

test('recognizes a completed manual sync response and requests one data refresh', async () => {
  const result = await readManualSyncResult(new Response(JSON.stringify({
    summary: { connections: { attempted: 2, succeeded: 2, failed: 0 }, events: { imported: 1, updated: 0, removed: 0 } },
  }), { status: 202 }));

  expect(result).toEqual({ state: 'success', shouldRefresh: true });
});

test('recognizes partial and rejected manual sync responses without fabricating success', async () => {
  const partial = await readManualSyncResult(new Response(JSON.stringify({
    summary: { connections: { attempted: 2, succeeded: 1, failed: 1 }, events: { imported: 1, updated: 0, removed: 0 } },
  }), { status: 202 }));
  const failed = await readManualSyncResult(new Response(JSON.stringify({ error: 'Unable to synchronize calendars' }), { status: 500 }));

  expect(partial).toEqual({ state: 'partial', shouldRefresh: true });
  expect(failed).toEqual({ state: 'error', shouldRefresh: false });
});

test('treats an accepted summary with no successful connections as a full error', async () => {
  const result = await readManualSyncResult(new Response(JSON.stringify({
    summary: { connections: { attempted: 2, succeeded: 0, failed: 2 }, events: { imported: 0, updated: 0, removed: 0 } },
  }), { status: 202 }));

  expect(result).toEqual({ state: 'error', shouldRefresh: false });
});
