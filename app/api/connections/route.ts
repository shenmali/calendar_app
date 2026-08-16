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
  is_active: boolean;
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
    .select('id, provider, provider_account_id, scopes, token_expires_at, is_active, last_synced_at, created_at')
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
      isActive: connection.is_active,
      lastSyncedAt: connection.last_synced_at,
      createdAt: connection.created_at,
    }];
  });

  const { data: sourceData, error: sourceError } = await createAdminClient()
    .from('calendar_sources')
    .select('id, connection_id, name, color, is_selected')
    .eq('user_id', user.id);
  if (sourceError) return NextResponse.json({ error: 'Unable to list calendar sources' }, { status: 500 });

  const connectionIds = new Set(connections.map((connection) => connection.id));
  const sources = (sourceData as Array<{ id: string; connection_id: string; name: string; color: string | null; is_selected: boolean }>)
    .flatMap((source) => connectionIds.has(source.connection_id) ? [{
      id: source.id,
      connectionId: source.connection_id,
      name: source.name,
      color: source.color,
      isSelected: source.is_selected,
    }] : []);

  return NextResponse.json({ connections, sources });
}
