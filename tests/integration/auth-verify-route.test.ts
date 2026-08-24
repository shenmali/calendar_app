import { NextRequest } from 'next/server';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createServerClient: vi.fn(),
  from: vi.fn(),
  signOut: vi.fn(),
  upsert: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createServerClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { POST } from '@/app/auth/verify/route';

const allowedUser = {
  id: 'c2fa7f5b-b00d-4efb-934d-932a1c65d48e',
  email: 'owner@example.com',
};

function request(body: unknown) {
  return new NextRequest('https://calendar.example.com/auth/verify', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
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
      signOut: mocks.signOut,
      verifyOtp: mocks.verifyOtp,
    },
  });
  mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockResolvedValue({ data: { user: allowedUser }, error: null });
  mockAllowedUserLookup(true);
});

afterEach(() => vi.unstubAllEnvs());

test('verifies an allowed email code, provisions the profile, and returns success', async () => {
  const response = await POST(request({ email: ' owner@example.com ', token: '12345678' }));

  expect(mocks.verifyOtp).toHaveBeenCalledWith({
    email: 'owner@example.com',
    token: '12345678',
    type: 'email',
  });
  expect(mocks.upsert).toHaveBeenCalledWith(
    { id: allowedUser.id, user_id: allowedUser.id, email: allowedUser.email },
    { onConflict: 'id' },
  );
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});

test('verifies an eight-digit email code from hosted Supabase Auth', async () => {
  const response = await POST(request({ email: 'owner@example.com', token: '12345678' }));

  expect(mocks.verifyOtp).toHaveBeenCalledWith({
    email: 'owner@example.com',
    token: '12345678',
    type: 'email',
  });
  expect(response.status).toBe(200);
});

test('rejects a legacy six-digit code before calling Supabase Auth', async () => {
  const response = await POST(request({ email: 'owner@example.com', token: '123456' }));

  expect(mocks.verifyOtp).not.toHaveBeenCalled();
  expect(response.status).toBe(400);
});

test('rejects an invalid code without attempting allow-list access', async () => {
  mocks.verifyOtp.mockResolvedValue({ data: { user: null }, error: new Error('invalid token') });

  const response = await POST(request({ email: 'owner@example.com', token: '00000000' }));

  expect(mocks.from).not.toHaveBeenCalled();
  expect(response.status).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: 'Kod doğrulanamadı. Lütfen yeni bir kod isteyin.' });
});

test('rejects malformed payloads before attempting code verification', async () => {
  const response = await POST(request({ email: 'owner@example.com', token: 'not-a-code' }));

  expect(mocks.verifyOtp).not.toHaveBeenCalled();
  expect(mocks.from).not.toHaveBeenCalled();
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({ error: 'Kod doğrulanamadı. Lütfen yeni bir kod isteyin.' });
});

test('signs out a verified code user with no active membership', async () => {
  mockAllowedUserLookup(false);

  const response = await POST(request({ email: 'owner@example.com', token: '12345678' }));

  expect(mocks.signOut).toHaveBeenCalledOnce();
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toEqual({ error: 'Bu hesap takvime erişemez.' });
});
