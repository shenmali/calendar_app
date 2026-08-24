import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { afterEach, expect, test, vi } from 'vitest';

import { consumeOAuthState, createOAuthState } from '@/lib/providers/oauth-state';

const url = process.env.LOCAL_SUPABASE_URL;
const serviceRoleKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && serviceRoleKey);
const createdUserIds: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  if (!canRun) return;
  const admin = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  await Promise.all(createdUserIds.splice(0).map((id) => admin.auth.admin.deleteUser(id)));
});

test.skipIf(!canRun)('deleting a connection removes its dependent source and event rows in local Supabase', async () => {
  const admin = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = randomUUID();
  const { data: userResult, error: userError } = await admin.auth.admin.createUser({
    email: `cascade-${suffix}@example.test`, password: 'test-password-which-is-long-enough', email_confirm: true,
  });
  expect(userError).toBeNull();
  expect(userResult.user).not.toBeNull();
  const userId = userResult.user!.id;
  createdUserIds.push(userId);

  const { data: connection, error: connectionError } = await admin.from('oauth_connections').insert({
    user_id: userId, provider: 'google', provider_account_id: `cascade-${suffix}`,
    access_token_ciphertext: 'test-ciphertext', scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  }).select('id').single();
  expect(connectionError).toBeNull();

  const { data: source, error: sourceError } = await admin.from('calendar_sources').insert({
    user_id: userId, connection_id: connection!.id, remote_calendar_id: `calendar-${suffix}`, name: 'Cascade test',
  }).select('id').single();
  expect(sourceError).toBeNull();

  const { data: event, error: eventError } = await admin.from('calendar_events').insert({
    user_id: userId, connection_id: connection!.id, source_id: source!.id, remote_event_id: `event-${suffix}`,
    title: 'Cascade test', starts_at: '2026-08-15T10:00:00.000Z', ends_at: '2026-08-15T11:00:00.000Z',
  }).select('id').single();
  expect(eventError).toBeNull();

  const { error: deleteError } = await admin.from('oauth_connections').delete().eq('id', connection!.id).eq('user_id', userId);
  expect(deleteError).toBeNull();

  const [sourceAfterDelete, eventAfterDelete] = await Promise.all([
    admin.from('calendar_sources').select('id').eq('id', source!.id).maybeSingle(),
    admin.from('calendar_events').select('id').eq('id', event!.id).maybeSingle(),
  ]);
  expect(sourceAfterDelete.error).toBeNull();
  expect(sourceAfterDelete.data).toBeNull();
  expect(eventAfterDelete.error).toBeNull();
  expect(eventAfterDelete.data).toBeNull();
});

test.skipIf(!canRun)('local database consumes an OAuth state nonce only once under its conditional update', async () => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 9).toString('base64'));
  const admin = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = randomUUID();
  const { data: userResult, error: userError } = await admin.auth.admin.createUser({
    email: `nonce-${suffix}@example.test`, password: 'test-password-which-is-long-enough', email_confirm: true,
  });
  expect(userError).toBeNull();
  const userId = userResult.user!.id;
  createdUserIds.push(userId);
  const state = createOAuthState({ userId, provider: 'google' });
  const { error: insertError } = await admin.from('oauth_state_nonces').insert({
    nonce: state.nonce, user_id: userId, provider: 'google', expires_at: state.expiresAt.toISOString(),
  });
  expect(insertError).toBeNull();

  const input = {
    state: state.value, cookieState: state.value, userId, provider: 'google' as const,
    consumeNonce: async (nonce: string) => {
      const { data, error } = await admin.from('oauth_state_nonces')
        .update({ consumed_at: new Date().toISOString() })
        .eq('nonce', nonce).eq('user_id', userId).eq('provider', 'google')
        .is('consumed_at', null).gt('expires_at', new Date().toISOString())
        .select('nonce').maybeSingle();
      return !error && Boolean(data);
    },
  };

  await expect(consumeOAuthState(input)).resolves.toEqual({ userId, provider: 'google' });
  await expect(consumeOAuthState(input)).rejects.toThrow('Invalid OAuth state');
});

test.skipIf(!canRun)('local database rejects a source whose owner differs from its connection owner', async () => {
  const admin = createClient(url!, serviceRoleKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  const suffix = randomUUID();
  const [{ data: ownerResult, error: ownerError }, { data: otherResult, error: otherError }] = await Promise.all([
    admin.auth.admin.createUser({ email: `source-owner-${suffix}@example.test`, password: 'test-password-which-is-long-enough', email_confirm: true }),
    admin.auth.admin.createUser({ email: `source-other-${suffix}@example.test`, password: 'test-password-which-is-long-enough', email_confirm: true }),
  ]);
  expect(ownerError).toBeNull();
  expect(otherError).toBeNull();
  createdUserIds.push(ownerResult.user!.id, otherResult.user!.id);

  const { data: connection, error: connectionError } = await admin.from('oauth_connections').insert({
    user_id: ownerResult.user!.id, provider: 'google', provider_account_id: `owner-${suffix}`, access_token_ciphertext: 'test-ciphertext',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  }).select('id').single();
  expect(connectionError).toBeNull();

  const { error } = await admin.from('calendar_sources').insert({
    user_id: otherResult.user!.id, connection_id: connection!.id, remote_calendar_id: `wrong-owner-${suffix}`, name: 'Wrong owner',
  });
  expect(error).not.toBeNull();
  expect(error!.message).toContain('calendar source owner');
});
