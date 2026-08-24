import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }));

import { middleware } from '@/middleware';

function membershipQuery(status: 'active' | 'revoked' | null) {
  const result = Promise.resolve({ data: status ? { status } : null, error: null });
  const chain = {
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => result),
    select: vi.fn(() => chain),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  mocks.createServerClient.mockReturnValue({ auth: { getUser: mocks.getUser, signOut: mocks.signOut } });
  mocks.createClient.mockReturnValue({ from: mocks.from });
  mocks.signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

test('permits an authenticated active member', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'member-id' } }, error: null });
  mocks.from.mockReturnValue(membershipQuery('active'));

  const response = await middleware(new NextRequest('https://calendar.example.com/'));

  expect(response.status).toBe(200);
  expect(mocks.signOut).not.toHaveBeenCalled();
});

test('signs out and redirects a revoked member even with a valid session', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'member-id' } }, error: null });
  mocks.from.mockReturnValue(membershipQuery('revoked'));

  const response = await middleware(new NextRequest('https://calendar.example.com/'));

  expect(response.status).toBe(307);
  expect(response.headers.get('location')).toBe('https://calendar.example.com/login?error=unauthorized');
  expect(mocks.signOut).toHaveBeenCalledOnce();
});
