import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createServerClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { GET, POST } from '@/app/api/users/route';
import { PATCH } from '@/app/api/users/[id]/route';

function query(data: unknown, error: unknown = null) {
  const result = Promise.resolve({ data, error });
  const chain = {
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(() => result),
    order: vi.fn(() => result),
    select: vi.fn(() => chain),
    single: vi.fn(() => result),
    update: vi.fn(() => chain),
    upsert: vi.fn(() => chain),
  };
  return chain;
}

function ownerQuery() {
  return query({ role: 'owner', status: 'active' });
}

function jsonRequest(body: unknown) {
  return new Request('https://calendar.example.com/api/users', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.createAdminClient.mockReturnValue({
    from: mocks.from,
    auth: { admin: {
      listUsers: mocks.listUsers,
      createUser: mocks.createUser,
      updateUserById: mocks.updateUserById,
    } },
  });
});

test('a member cannot list managed users', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'member-id' } }, error: null });
  mocks.from.mockReturnValue(query({ role: 'member', status: 'active' }));

  const response = await GET();

  expect(response.status).toBe(403);
});

test('an owner adds a normalized member without returning Auth credentials', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-id' } }, error: null });
  mocks.from
    .mockReturnValueOnce(ownerQuery())
    .mockReturnValueOnce(query({
      id: 'member-row', email: 'member@example.com', role: 'member', status: 'active',
      created_at: '2026-08-17T00:00:00.000Z', revoked_at: null,
    }));
  mocks.listUsers.mockResolvedValue({ data: { users: [] }, error: null });
  mocks.createUser.mockResolvedValue({ data: { user: { id: 'member-id' } }, error: null });

  const response = await POST(jsonRequest({ email: ' Member@Example.com ' }));

  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(expect.objectContaining({ email: 'member@example.com' }));
  expect(mocks.createUser).toHaveBeenCalledWith({ email: 'member@example.com', email_confirm: true });
});

test('an owner cannot revoke self or another owner', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-id' } }, error: null });
  mocks.from
    .mockReturnValueOnce(ownerQuery())
    .mockReturnValueOnce(query({ id: 'owner-row', user_id: 'owner-id', role: 'owner', status: 'active' }));

  const response = await PATCH(jsonRequest({ status: 'revoked' }), {
    params: Promise.resolve({ id: 'owner-row' }),
  });

  expect(response.status).toBe(400);
  expect(mocks.updateUserById).not.toHaveBeenCalled();
});

test('an owner revokes a member through the Auth ban API', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner-id' } }, error: null });
  mocks.from
    .mockReturnValueOnce(ownerQuery())
    .mockReturnValueOnce(query({ id: 'member-row', user_id: 'member-id', role: 'member', status: 'active' }))
    .mockReturnValueOnce(query({
      id: 'member-row', email: 'member@example.com', role: 'member', status: 'revoked',
      created_at: '2026-08-17T00:00:00.000Z', revoked_at: '2026-08-17T01:00:00.000Z',
    }));
  mocks.updateUserById.mockResolvedValue({ error: null });

  const response = await PATCH(jsonRequest({ status: 'revoked' }), {
    params: Promise.resolve({ id: 'member-row' }),
  });

  expect(response.status).toBe(200);
  expect(mocks.updateUserById).toHaveBeenCalledWith('member-id', { ban_duration: '876000h' });
});

test('user management list requires an authenticated owner', async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

  const response = await GET();

  expect(response.status).toBe(401);
});
