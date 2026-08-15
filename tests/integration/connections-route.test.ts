import { NextRequest } from 'next/server';
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createServerClient: vi.fn(),
  from: vi.fn(),
  getUser: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createServerClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from '@/app/api/connections/route';
import { DELETE } from '@/app/api/connections/[id]/route';

const user = { id: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca' };
const storedConnection = {
  id: '10721c2c-eebf-496b-a84e-6895b02dbff3',
  provider: 'google',
  provider_account_id: 'calendar-owner@example.com',
  access_token_ciphertext: 'never-return-this',
  refresh_token_ciphertext: 'never-return-this-either',
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  token_expires_at: '2026-08-15T12:00:00.000Z',
  last_synced_at: null,
  created_at: '2026-08-15T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.createAdminClient.mockReturnValue({ from: mocks.from });
});

test('lists only sanitized metadata for the authenticated user', async () => {
  mocks.from.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ order: mocks.order });
  mocks.order.mockResolvedValue({ data: [storedConnection], error: null });

  const response = await GET(new NextRequest('https://calendar.example.com/api/connections'));
  const body = await response.json();

  expect(mocks.select).toHaveBeenCalledWith(
    'id, provider, provider_account_id, scopes, token_expires_at, last_synced_at, created_at',
  );
  expect(body).toEqual({
    connections: [
      {
        id: '10721c2c-eebf-496b-a84e-6895b02dbff3',
        provider: 'google',
        providerAccountId: 'calendar-owner@example.com',
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        tokenExpiresAt: '2026-08-15T12:00:00.000Z',
        lastSyncedAt: null,
        createdAt: '2026-08-15T10:00:00.000Z',
      },
    ],
  });
  expect(JSON.stringify(body)).not.toContain('ciphertext');
  expect(JSON.stringify(body)).not.toContain('never-return-this');
});

test('deleting an owned connection relies on database cascading to remove its sources and events', async () => {
  mocks.from.mockReturnValue({ delete: mocks.delete });
  mocks.delete.mockReturnValue({ eq: mocks.eq });
  mocks.eq
    .mockReturnValueOnce({ eq: mocks.eq })
    .mockResolvedValueOnce({ error: null });

  const response = await DELETE(
    new NextRequest('https://calendar.example.com/api/connections/10721c2c-eebf-496b-a84e-6895b02dbff3'),
    { params: Promise.resolve({ id: '10721c2c-eebf-496b-a84e-6895b02dbff3' }) },
  );

  expect(mocks.from).toHaveBeenCalledWith('oauth_connections');
  expect(mocks.delete).toHaveBeenCalledOnce();
  expect(mocks.eq).toHaveBeenNthCalledWith(1, 'id', '10721c2c-eebf-496b-a84e-6895b02dbff3');
  expect(mocks.eq).toHaveBeenNthCalledWith(2, 'user_id', user.id);
  expect(await response.json()).toEqual({ deleted: true });
});
