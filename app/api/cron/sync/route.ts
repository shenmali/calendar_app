import { createCronSyncHandler } from '@/lib/providers/sync-handlers';
import { createAdminSyncLockStore, createSyncCoordinator, listActiveConnections } from '@/lib/providers/sync-lock';
import { syncConnection } from '@/lib/providers/sync';

const coordinator = createSyncCoordinator({ locks: createAdminSyncLockStore(), syncConnection });

export const GET = createCronSyncHandler({
  cronSecret: process.env.CRON_SECRET,
  listActiveConnections: () => listActiveConnections(),
  synchronizeUser: (userId, connections) => coordinator.synchronizeUser(userId, connections),
});
