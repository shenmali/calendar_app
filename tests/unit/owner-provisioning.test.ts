import { expect, test, vi } from 'vitest';
import { provisionOwner } from '@/scripts/provision-owner-lib.mjs';

test('reuses an existing auth user and upserts active owner membership', async () => {
  const createUser = vi.fn();
  const upsertAllowedUser = vi.fn().mockResolvedValue(undefined);

  const result = await provisionOwner({
    ownerEmail: ' OWNER@Example.com ',
    listUsers: async () => [{ id: 'owner-id', email: 'owner@example.com' }],
    createUser,
    upsertAllowedUser,
  });

  expect(result).toEqual({ createdAuthUser: false });
  expect(createUser).not.toHaveBeenCalled();
  expect(upsertAllowedUser).toHaveBeenCalledWith({
    user_id: 'owner-id',
    email: 'owner@example.com',
    role: 'owner',
    status: 'active',
    revoked_at: null,
  });
});

test('creates an email-confirmed owner when auth user is absent', async () => {
  const createUser = vi.fn().mockResolvedValue({ id: 'new-owner-id', email: 'owner@example.com' });
  const upsertAllowedUser = vi.fn().mockResolvedValue(undefined);

  const result = await provisionOwner({
    ownerEmail: 'owner@example.com',
    listUsers: async () => [],
    createUser,
    upsertAllowedUser,
  });

  expect(result).toEqual({ createdAuthUser: true });
  expect(createUser).toHaveBeenCalledWith({ email: 'owner@example.com', email_confirm: true });
  expect(upsertAllowedUser).toHaveBeenCalledWith({
    user_id: 'new-owner-id',
    email: 'owner@example.com',
    role: 'owner',
    status: 'active',
    revoked_at: null,
  });
});
