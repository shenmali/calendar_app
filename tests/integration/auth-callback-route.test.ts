import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createServerClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createServerClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from '@/app/auth/callback/route';

const allowedUser = {
  id: 'c2fa7f5b-b00d-4efb-934d-932a1c65d48e',
  email: 'owner@example.com',
};

function callbackRequest() {
  return new NextRequest('https://calendar.example.com/auth/callback?code=magic-code');
}

function mockAllowedUserLookup(active: boolean) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: active ? { id: 'allowed-row' } : null, error: null });
  const statusEq = vi.fn().mockReturnValue({ maybeSingle });
  const emailEq = vi.fn().mockReturnValue({ eq: statusEq });
  const userEq = vi.fn().mockReturnValue({ eq: emailEq });
  const select = vi.fn().mockReturnValue({ eq: userEq });

  mocks.from.mockImplementation((table: string) => {
    if (table === 'allowed_users') return { select };
    return { upsert: mocks.upsert };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServerClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getUser: mocks.getUser,
      signOut: mocks.signOut,
    },
  });
  mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mockAllowedUserLookup(true);
});

afterEach(() => vi.unstubAllEnvs());

test('redirects to login when the callback code exchange fails', async () => {
  mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error('expired code') });

  const response = await GET(callbackRequest());

  expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith('magic-code');
  expect(mocks.getUser).not.toHaveBeenCalled();
  expect(response.headers.get('location')).toBe(
    'https://calendar.example.com/login?error=auth_callback',
  );
});

test('signs out a verified callback user absent from active allowlist', async () => {
  mockAllowedUserLookup(false);
  mocks.getUser.mockResolvedValue({
    data: { user: { ...allowedUser, email: 'other@example.com' } },
    error: null,
  });

  const response = await GET(callbackRequest());

  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(response.headers.get('location')).toBe(
    'https://calendar.example.com/login?error=unauthorized',
  );
});

test('writes a profile only after active allowlist authorization', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: allowedUser }, error: null });

  const response = await GET(callbackRequest());

  expect(mocks.from).toHaveBeenCalledWith('allowed_users');
  expect(mocks.from).toHaveBeenCalledWith('profiles');
  expect(mocks.upsert).toHaveBeenCalledWith(
    { id: allowedUser.id, user_id: allowedUser.id, email: allowedUser.email },
    { onConflict: 'id' },
  );
  expect(response.headers.get('location')).toBe('https://calendar.example.com/');
});
