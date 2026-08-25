import { NextRequest, NextResponse } from 'next/server';

import { consumeOAuthState, oauthStateCookieName } from '@/lib/providers/oauth-state';
import { appUrl, oauthClientCredentials, oauthRedirectUri } from '@/lib/providers/oauth';
import { defaultSyncRange } from '@/lib/providers/sync-lock';
import { syncConnection } from '@/lib/providers/sync';
import { providerScopes, providerTokenEndpoints, type OAuthProvider } from '@/lib/providers/types';
import { encryptToken } from '@/lib/security/token-crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };

function clearOAuthCookies(response: NextResponse, provider: OAuthProvider) {
  response.cookies.delete(oauthStateCookieName(provider));
  response.cookies.delete(`oauth_pkce_${provider}`);
  return response;
}

function errorRedirect(provider: OAuthProvider): NextResponse {
  return clearOAuthCookies(NextResponse.redirect(appUrl()), provider);
}

function parseTokenResponse(value: unknown): TokenResponse | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const response = value as Record<string, unknown>;
  if (typeof response.access_token !== 'string') return undefined;
  return {
    access_token: response.access_token,
    refresh_token: typeof response.refresh_token === 'string' ? response.refresh_token : undefined,
    expires_in: typeof response.expires_in === 'number' ? response.expires_in : undefined,
    scope: typeof response.scope === 'string' ? response.scope : undefined,
  };
}

async function fetchProviderAccountId(provider: OAuthProvider, accessToken: string): Promise<string> {
  const endpoint = provider === 'google'
    ? 'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary'
    : 'https://graph.microsoft.com/v1.0/me/calendars?$select=id,isDefaultCalendar';
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store',
  });
  if (!response.ok) throw new Error('Provider account lookup failed');
  const result: unknown = await response.json();

  if (provider === 'google') {
    const id = typeof result === 'object' && result ? (result as { id?: unknown }).id : undefined;
    if (typeof id !== 'string' || !id) throw new Error('Provider account lookup failed');
    return id;
  }

  const calendars = typeof result === 'object' && result ? (result as { value?: unknown }).value : undefined;
  if (!Array.isArray(calendars)) throw new Error('Provider account lookup failed');
  const calendar = calendars.find((item) => typeof item === 'object' && item && (item as { isDefaultCalendar?: unknown }).isDefaultCalendar === true)
    ?? calendars[0];
  const id = typeof calendar === 'object' && calendar ? (calendar as { id?: unknown }).id : undefined;
  if (typeof id !== 'string' || !id) throw new Error('Provider account lookup failed');
  return id;
}

export async function handleOAuthCallback(request: NextRequest, provider: OAuthProvider): Promise<NextResponse> {
  let safeAppUrl: URL;
  try {
    safeAppUrl = appUrl();
  } catch {
    return clearOAuthCookies(NextResponse.json({ error: 'OAuth configuration error' }, { status: 500 }), provider);
  }
  if (request.nextUrl.origin !== safeAppUrl.origin) {
    return clearOAuthCookies(NextResponse.json({ error: 'Invalid callback origin' }, { status: 400 }), provider);
  }

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const state = request.nextUrl.searchParams.get('state');
  const code = request.nextUrl.searchParams.get('code');
  const providerError = request.nextUrl.searchParams.get('error');
  const stateCookie = request.cookies.get(oauthStateCookieName(provider))?.value;
  const verifier = request.cookies.get(`oauth_pkce_${provider}`)?.value;

  try {
    if (userError || !user || !state || !code || providerError || !verifier) throw new Error('Invalid callback');
    await consumeOAuthState({
      state, cookieState: stateCookie, userId: user.id, provider,
      consumeNonce: async (nonce) => {
        const { data, error } = await createAdminClient()
          .from('oauth_state_nonces')
          .update({ consumed_at: new Date().toISOString() })
          .eq('nonce', nonce)
          .eq('user_id', user.id)
          .eq('provider', provider)
          .is('consumed_at', null)
          .gt('expires_at', new Date().toISOString())
          .select('nonce')
          .maybeSingle();
        return !error && Boolean(data);
      },
    });

    const credentials = oauthClientCredentials(provider);
    const tokenResponse = await fetch(providerTokenEndpoints[provider], {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: credentials.clientId, client_secret: credentials.clientSecret, code,
        code_verifier: verifier, grant_type: 'authorization_code', redirect_uri: oauthRedirectUri(provider),
      }),
    });
    if (!tokenResponse.ok) throw new Error('Token exchange failed');
    const tokens = parseTokenResponse(await tokenResponse.json());
    if (!tokens) throw new Error('Invalid token response');

    const providerAccountId = await fetchProviderAccountId(provider, tokens.access_token);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null;
    const { data: existingConnection, error: existingConnectionError } = await createAdminClient()
      .from('oauth_connections')
      .select('user_id, refresh_token_ciphertext')
      .eq('provider', provider)
      .eq('provider_account_id', providerAccountId)
      .maybeSingle();
    if (existingConnectionError) throw new Error('Unable to read existing connection');
    if (existingConnection && existingConnection.user_id !== user.id) throw new Error('Connection belongs to another user');

    const refreshTokenCiphertext = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : existingConnection?.refresh_token_ciphertext ?? null;
    const { data: connection, error: writeError } = await createAdminClient().from('oauth_connections').upsert({
      user_id: user.id,
      provider,
      provider_account_id: providerAccountId,
      access_token_ciphertext: encryptToken(tokens.access_token),
      refresh_token_ciphertext: refreshTokenCiphertext,
      token_expires_at: expiresAt,
      scopes: providerScopes[provider],
    }, { onConflict: 'provider,provider_account_id' }).select('id').single();
    if (writeError || !connection) throw new Error('Connection write failed');

    // A newly connected calendar should be visible immediately. The sync
    // layer also repairs older connections that predate calendar sources.
    try {
      await syncConnection(connection.id, defaultSyncRange());
    } catch {
      // Preserve the completed connection so the user can retry with Yenile.
    }
    return clearOAuthCookies(NextResponse.redirect(safeAppUrl), provider);
  } catch {
    return errorRedirect(provider);
  }
}
