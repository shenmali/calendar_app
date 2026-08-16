import { createManualSyncHandler } from '@/lib/providers/sync-handlers';
import { createAdminSyncLockStore, createSyncCoordinator, listActiveConnections } from '@/lib/providers/sync-lock';
import { syncConnection } from '@/lib/providers/sync';
import { createClient } from '@/lib/supabase/server';

const coordinator = createSyncCoordinator({ locks: createAdminSyncLockStore(), syncConnection });

export const POST = createManualSyncHandler({
  async currentUserId() {
    const { data: { user }, error } = await (await createClient()).auth.getUser();
    return error || !user ? null : user.id;
  },
  listActiveConnections,
  synchronizeUser: (userId, connections) => coordinator.synchronizeUser(userId, connections),
});
