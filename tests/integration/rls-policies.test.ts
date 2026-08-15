import { createClient } from '@supabase/supabase-js';
import { expect, test } from 'vitest';

const rlsTestConfig = {
  url: process.env.SUPABASE_RLS_TEST_URL,
  publishableKey: process.env.SUPABASE_RLS_TEST_PUBLISHABLE_KEY,
  ownerAccessToken: process.env.SUPABASE_RLS_TEST_OWNER_ACCESS_TOKEN,
  otherAccessToken: process.env.SUPABASE_RLS_TEST_OTHER_ACCESS_TOKEN,
  ownerEventId: process.env.SUPABASE_RLS_TEST_OWNER_EVENT_ID,
  ownerConnectionId: process.env.SUPABASE_RLS_TEST_OWNER_CONNECTION_ID,
};

const hasRlsTestConfig = Object.values(rlsTestConfig).every(Boolean);

test.skipIf(!hasRlsTestConfig)(
  'ikinci kullanıcı başka kullanıcının event veya bağlantısını okuyamaz',
  async () => {
    const owner = createClient(
      rlsTestConfig.url!,
      rlsTestConfig.publishableKey!,
      { global: { headers: { Authorization: `Bearer ${rlsTestConfig.ownerAccessToken!}` } } },
    );
    const otherUser = createClient(
      rlsTestConfig.url!,
      rlsTestConfig.publishableKey!,
      { global: { headers: { Authorization: `Bearer ${rlsTestConfig.otherAccessToken!}` } } },
    );

    const ownerEvent = await owner
      .from('calendar_events')
      .select('id')
      .eq('id', rlsTestConfig.ownerEventId!)
      .single();
    expect(ownerEvent.error).toBeNull();
    expect(ownerEvent.data).toEqual({ id: rlsTestConfig.ownerEventId });

    const otherUserEvent = await otherUser
      .from('calendar_events')
      .select('id')
      .eq('id', rlsTestConfig.ownerEventId!)
      .maybeSingle();
    expect(otherUserEvent.error).toBeNull();
    expect(otherUserEvent.data).toBeNull();

    const otherUserConnection = await otherUser
      .from('oauth_connections')
      .select('id')
      .eq('id', rlsTestConfig.ownerConnectionId!)
      .maybeSingle();
    expect(otherUserConnection.data).toBeNull();
    expect(otherUserConnection.error).not.toBeNull();
  },
);
