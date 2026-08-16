import { randomUUID } from 'node:crypto';

import type { DateRange, SyncResult } from '@/lib/calendar/types';

const LOCK_TTL_SECONDS = 15 * 60;

export type ActiveConnection = { id: string; userId: string };

export type SyncSummary = {
  connections: { attempted: number; succeeded: number; failed: number };
  events: { imported: number; updated: number; removed: number };
};

export type UserSyncResult = { status: 'locked' | 'completed'; summary: SyncSummary };

export interface SyncLockStore {
  acquire(userId: string, ownerId: string): Promise<boolean>;
  release(userId: string, ownerId: string): Promise<void>;
}

type SyncConnection = (connectionId: string, range: DateRange) => Promise<SyncResult>;

export function emptySyncSummary(): SyncSummary {
  return {
    connections: { attempted: 0, succeeded: 0, failed: 0 },
    events: { imported: 0, updated: 0, removed: 0 },
  };
}

export async function withSyncLock<T>(
  { locks, userId, ownerId }: { locks: SyncLockStore; userId: string; ownerId: string },
  operation: () => Promise<T>,
): Promise<{ acquired: boolean; value?: T }> {
  if (!await locks.acquire(userId, ownerId)) return { acquired: false };
  try {
    return { acquired: true, value: await operation() };
  } finally {
    await locks.release(userId, ownerId);
  }
}

export function defaultSyncRange(now = new Date()): DateRange {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 30);
  const end = new Date(now);
  end.setUTCDate(end.getUTCDate() + 365);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function createSyncCoordinator({
  locks, syncConnection, createLockId = randomUUID, range = () => defaultSyncRange(),
}: { locks: SyncLockStore; syncConnection: SyncConnection; createLockId?: () => string; range?: () => DateRange }) {
  return {
    async synchronizeUser(userId: string, connections: ActiveConnection[]): Promise<UserSyncResult> {
      const locked = await withSyncLock({ locks, userId, ownerId: createLockId() }, async () => {
        const summary = emptySyncSummary();
        const syncRange = range();
        for (const connection of connections) {
          summary.connections.attempted += 1;
          try {
            const result = await syncConnection(connection.id, syncRange);
            summary.connections.succeeded += 1;
            summary.events.imported += result.imported;
            summary.events.updated += result.updated;
            summary.events.removed += result.removed;
          } catch {
            // Provider errors are captured in the existing sync run and must
            // not prevent a later connection from synchronizing.
            summary.connections.failed += 1;
          }
        }
        return summary;
      });

      return locked.acquired
        ? { status: 'completed', summary: locked.value! }
        : { status: 'locked', summary: emptySyncSummary() };
    },
  };
}

export function createAdminSyncLockStore(): SyncLockStore {
  // Dynamic loading keeps the pure coordinator usable in Vitest without the
  // Next-only `server-only` module while retaining a privileged client at the
  // actual server boundary.
  const client = async () => (await import('@/lib/supabase/admin')).createAdminClient();
  return {
    async acquire(userId, ownerId) {
      const { data, error } = await (await client()).rpc('acquire_sync_lock', {
        p_user_id: userId, p_owner_id: ownerId, p_ttl_seconds: LOCK_TTL_SECONDS,
      });
      if (error || typeof data !== 'boolean') throw new Error('Unable to acquire sync lock');
      return data;
    },
    async release(userId, ownerId) {
      const { error } = await (await client()).rpc('release_sync_lock', { p_user_id: userId, p_owner_id: ownerId });
      if (error) throw new Error('Unable to release sync lock');
    },
  };
}

export async function listActiveConnections(userId?: string): Promise<ActiveConnection[]> {
  const client = (await import('@/lib/supabase/admin')).createAdminClient();
  let query = client.from('oauth_connections').select('id, user_id').eq('is_active', true);
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw new Error('Unable to list active calendar connections');
  return (data ?? []).flatMap((connection) => (
    typeof connection.id === 'string' && typeof connection.user_id === 'string'
      ? [{ id: connection.id, userId: connection.user_id }]
      : []
  ));
}
