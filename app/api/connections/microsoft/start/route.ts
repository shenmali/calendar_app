import { NextRequest, NextResponse } from 'next/server';

import { createOAuthState, oauthStateCookieName } from '@/lib/providers/oauth-state';
import { createPkcePair, oauthClientCredentials, oauthRedirectUri, scopeFor } from '@/lib/providers/oauth';
import { providerAuthorizationEndpoints } from '@/lib/providers/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  void _request;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const state = createOAuthState({ userId: user.id, provider: 'microsoft' });
    const { error: stateError } = await createAdminClient().from('oauth_state_nonces').insert({
      nonce: state.nonce, user_id: user.id, provider: 'microsoft', expires_at: state.expiresAt.toISOString(),
    });
    if (stateError) throw new Error('Unable to persist OAuth state');
    const pkce = createPkcePair();
    const credentials = oauthClientCredentials('microsoft');
    const authorizationUrl = new URL(providerAuthorizationEndpoints.microsoft);
    authorizationUrl.search = new URLSearchParams({
      client_id: credentials.clientId, redirect_uri: oauthRedirectUri('microsoft'), response_type: 'code',
      scope: scopeFor('microsoft'), state: state.value, code_challenge: pkce.challenge, code_challenge_method: 'S256',
    }).toString();
    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set(oauthStateCookieName('microsoft'), state.value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: state.expiresAt });
    response.cookies.set('oauth_pkce_microsoft', pkce.verifier, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: state.expiresAt });
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to start OAuth connection' }, { status: 500 });
  }
}
