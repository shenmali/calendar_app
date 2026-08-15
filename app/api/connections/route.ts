import { NextResponse } from 'next/server';

import type { ProviderConnection } from '@/lib/providers/types';
import { isOAuthProvider } from '@/lib/providers/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type ConnectionRow = {
  id: string;
  provider: string;
  provider_account_id: string;
  scopes: string[];
  token_expires_at: string | null;
  last_synced_at: string | null;
  created_at: string;
};

export async function GET(_request: Request) {
  void _request;
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await createAdminClient()
    .from('oauth_connections')
    .select('id, provider, provider_account_id, scopes, token_expires_at, last_synced_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Unable to list connections' }, { status: 500 });
  }

  const connections: ProviderConnection[] = (data as ConnectionRow[]).flatMap((connection) => {
    if (!isOAuthProvider(connection.provider)) {
      return [];
    }

    return [{
      id: connection.id,
      provider: connection.provider,
      providerAccountId: connection.provider_account_id,
      scopes: connection.scopes,
      tokenExpiresAt: connection.token_expires_at,
      lastSyncedAt: connection.last_synced_at,
      createdAt: connection.created_at,
    }];
  });

  return NextResponse.json({ connections });
}
