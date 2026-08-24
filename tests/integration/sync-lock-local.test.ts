import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { afterEach, expect, test } from 'vitest';

const url = process.env.LOCAL_SUPABASE_URL;
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && serviceRoleKey);
const createdUserIds: string[] = [];

afterEach(async () => {
  if (!canRun) return;
  const admin = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  await Promise.all(createdUserIds.splice(0).map((id) => admin.auth.admin.deleteUser(id)));
});

test.skipIf(!canRun)('an expired database lease can be atomically taken over by a new owner', async () => {
  const admin = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = randomUUID();
  const { data: userResult, error: userError } = await admin.auth.admin.createUser({
    email: `sync-lock-${suffix}@example.test`, password: 'test-password-which-is-long-enough', email_confirm: true,
  });
  expect(userError).toBeNull();
  expect(userResult.user).not.toBeNull();
  const userId = userResult.user!.id;
  createdUserIds.push(userId);

  const firstOwner = randomUUID();
  const secondOwner = randomUUID();
  const first = await admin.rpc('acquire_sync_lock', { p_user_id: userId, p_owner_id: firstOwner, p_ttl_seconds: 60 });
  expect(first.error).toBeNull();
  expect(first.data).toBe(true);

  const held = await admin.rpc('acquire_sync_lock', { p_user_id: userId, p_owner_id: secondOwner, p_ttl_seconds: 60 });
  expect(held.error).toBeNull();
  expect(held.data).toBe(false);

  const { error: expireError } = await admin.from('sync_locks').update({ locked_until: '2020-01-01T00:00:00.000Z' }).eq('user_id', userId);
  expect(expireError).toBeNull();

  const takeover = await admin.rpc('acquire_sync_lock', { p_user_id: userId, p_owner_id: secondOwner, p_ttl_seconds: 60 });
  expect(takeover.error).toBeNull();
  expect(takeover.data).toBe(true);
});
