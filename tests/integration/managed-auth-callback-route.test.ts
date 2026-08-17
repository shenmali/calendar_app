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
  email: 'member@example.com',
};

function callbackRequest() {
  return new NextRequest('https://calendar.example.com/auth/callback?code=magic-code');
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
  mocks.getUser.mockResolvedValue({ data: { user: allowedUser }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});

afterEach(() => vi.unstubAllEnvs());

test('callback authorizes an active allowlist user before profile upsert', async () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'allowed-row' }, error: null });
  const statusEq = vi.fn().mockReturnValue({ maybeSingle });
  const emailEq = vi.fn().mockReturnValue({ eq: statusEq });
  const userEq = vi.fn().mockReturnValue({ eq: emailEq });
  const select = vi.fn().mockReturnValue({ eq: userEq });

  mocks.from.mockImplementation((table: string) => {
    if (table === 'allowed_users') return { select };
    return { upsert: mocks.upsert };
  });

  const response = await GET(callbackRequest());

  expect(mocks.from).toHaveBeenNthCalledWith(1, 'allowed_users');
  expect(userEq).toHaveBeenCalledWith('user_id', allowedUser.id);
  expect(emailEq).toHaveBeenCalledWith('email', allowedUser.email);
  expect(statusEq).toHaveBeenCalledWith('status', 'active');
  expect(mocks.from).toHaveBeenNthCalledWith(2, 'profiles');
  expect(response.headers.get('location')).toBe('https://calendar.example.com/');
});
