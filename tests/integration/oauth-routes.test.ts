import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createAdminClient: vi.fn(),
  createOAuthState: vi.fn(),
  consumeOAuthState: vi.fn(),
  verifyOAuthState: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createServerClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock('@/lib/providers/oauth-state', () => ({
  createOAuthState: mocks.createOAuthState,
  consumeOAuthState: mocks.consumeOAuthState,
  verifyOAuthState: mocks.verifyOAuthState,
  oauthStateCookieName: (provider: string) => `oauth_state_${provider}`,
}));

import { GET as startGoogle } from '@/app/api/connections/google/start/route';
import { GET as googleCallback } from '@/app/api/connections/google/callback/route';

const user = { id: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://calendar.example.com');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret');
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 5).toString('base64'));
  mocks.createServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.createOAuthState.mockReturnValue({ value: 'signed-state', nonce: 'state-nonce', expiresAt: new Date('2026-08-15T12:00:00.000Z') });
  mocks.verifyOAuthState.mockReturnValue({ userId: user.id, provider: 'google' });
  mocks.consumeOAuthState.mockResolvedValue({ userId: user.id, provider: 'google' });
  mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  mocks.from.mockReturnValue({ insert: mocks.insert, select: mocks.select, upsert: mocks.upsert });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.maybeSingle });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test('google start uses the exact readonly scope, PKCE, and app-url callback', async () => {
  const response = await startGoogle(new NextRequest('https://calendar.example.com/api/connections/google/start'));
  const location = new URL(response.headers.get('location')!);

  expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
  expect(location.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/calendar.readonly');
  expect(location.searchParams.get('access_type')).toBe('offline');
  expect(location.searchParams.get('redirect_uri')).toBe('https://calendar.example.com/api/connections/google/callback');
  expect(location.searchParams.get('state')).toBe('signed-state');
  expect(location.searchParams.get('code_challenge_method')).toBe('S256');
  expect(location.searchParams.get('code_challenge')).toBeTruthy();
  expect(mocks.insert).toHaveBeenCalledWith({
    nonce: 'state-nonce', user_id: user.id, provider: 'google', expires_at: '2026-08-15T12:00:00.000Z',
  });
  expect(response.cookies.get('oauth_state_google')?.httpOnly).toBe(true);
});

test('google callback encrypts access and refresh tokens before its server-only write', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: 'access-secret',
      refresh_token: 'refresh-secret',
      expires_in: 3600,
    }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'owner@example.com' }), { status: 200 })));

  const response = await googleCallback(
    new NextRequest('https://calendar.example.com/api/connections/google/callback?code=auth-code&state=signed-state', {
      headers: { cookie: 'oauth_state_google=signed-state; oauth_pkce_google=verifier' },
    }),
  );

  expect(mocks.consumeOAuthState).toHaveBeenCalledWith(expect.objectContaining({
    state: 'signed-state', cookieState: 'signed-state', userId: user.id, provider: 'google',
  }));
  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
    user_id: user.id,
    provider: 'google',
    provider_account_id: 'owner@example.com',
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    access_token_ciphertext: expect.not.stringContaining('access-secret'),
    refresh_token_ciphertext: expect.not.stringContaining('refresh-secret'),
  }), { onConflict: 'provider,provider_account_id' });
  expect(response.headers.get('location')).toBe('https://calendar.example.com/');
  expect(response.headers.get('set-cookie')).toContain('oauth_state_google=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
});

test('google callback preserves the previous encrypted refresh token when no replacement is issued', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'access-secret', expires_in: 3600 }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'owner@example.com' }), { status: 200 })));
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: user.id, refresh_token_ciphertext: 'existing-refresh-ciphertext' }, error: null });

  await googleCallback(
    new NextRequest('https://calendar.example.com/api/connections/google/callback?code=auth-code&state=signed-state', {
      headers: { cookie: 'oauth_state_google=signed-state; oauth_pkce_google=verifier' },
    }),
  );

  expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
    refresh_token_ciphertext: 'existing-refresh-ciphertext',
  }), { onConflict: 'provider,provider_account_id' });
});

test('google callback clears OAuth cookies when its callback origin is rejected', async () => {
  const response = await googleCallback(new NextRequest(
    'https://untrusted.example/api/connections/google/callback?code=auth-code&state=signed-state',
    { headers: { cookie: 'oauth_state_google=signed-state; oauth_pkce_google=verifier' } },
  ));

  expect(response.status).toBe(400);
  expect(response.headers.get('set-cookie')).toContain('oauth_state_google=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
});
