import { createHash, timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import type { ActiveConnection, SyncSummary, UserSyncResult } from '@/lib/providers/sync-lock';

type ManualSyncDependencies = {
  currentUserId: () => Promise<string | null>;
  listActiveConnections: (userId: string) => Promise<ActiveConnection[]>;
  synchronizeUser: (userId: string, connections: ActiveConnection[]) => Promise<UserSyncResult>;
};

type CronSyncDependencies = {
  cronSecret: string | undefined;
  listActiveConnections: () => Promise<ActiveConnection[]>;
  synchronizeUser: (userId: string, connections: ActiveConnection[]) => Promise<UserSyncResult>;
};

function authorizedCronRequest(request: Request, secret: string | undefined): boolean {
  const authorization = request.headers.get('authorization');
  if (!secret || !authorization) return false;
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(`Bearer ${secret}`), digest(authorization));
}

function addSummary(target: SyncSummary, source: SyncSummary) {
  target.connections.attempted += source.connections.attempted;
  target.connections.succeeded += source.connections.succeeded;
  target.connections.failed += source.connections.failed;
  target.events.imported += source.events.imported;
  target.events.updated += source.events.updated;
  target.events.removed += source.events.removed;
}

export function createManualSyncHandler(dependencies: ManualSyncDependencies) {
  return async function POST(_request: Request) {
    void _request;
    try {
      const userId = await dependencies.currentUserId();
      if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const result = await dependencies.synchronizeUser(userId, await dependencies.listActiveConnections(userId));
      if (result.status === 'locked') return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 });
      return NextResponse.json({ summary: result.summary }, { status: 202 });
    } catch {
      return NextResponse.json({ error: 'Unable to synchronize calendars' }, { status: 500 });
    }
  };
}

export function createCronSyncHandler(dependencies: CronSyncDependencies) {
  return async function GET(request: Request) {
    if (!authorizedCronRequest(request, dependencies.cronSecret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const byUser = new Map<string, ActiveConnection[]>();
      for (const connection of await dependencies.listActiveConnections()) {
        byUser.set(connection.userId, [...(byUser.get(connection.userId) ?? []), connection]);
      }
      const aggregate: SyncSummary = {
        connections: { attempted: 0, succeeded: 0, failed: 0 },
        events: { imported: 0, updated: 0, removed: 0 },
      };
      let skippedLocked = 0;
      for (const [userId, connections] of byUser) {
        try {
          const result = await dependencies.synchronizeUser(userId, connections);
          if (result.status === 'locked') skippedLocked += 1;
          addSummary(aggregate, result.summary);
        } catch {
          // A defective connection or lease must not prevent another owner
          // from receiving its independently acquired daily synchronization.
          aggregate.connections.attempted += connections.length;
          aggregate.connections.failed += connections.length;
        }
      }
      return NextResponse.json({
        users: { attempted: byUser.size, skippedLocked },
        connections: aggregate.connections,
        events: aggregate.events,
      });
    } catch {
      return NextResponse.json({ error: 'Unable to synchronize calendars' }, { status: 500 });
    }
  };
}
