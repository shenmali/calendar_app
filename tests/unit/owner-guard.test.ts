import { expect, test } from 'vitest';
import { requireActiveOwner } from '@/lib/access/owner-guard';

test('rejects a request without an authenticated user', async () => {
  await expect(
    requireActiveOwner({
      getCurrentUser: async () => null,
      findAllowedUser: async () => null,
    }),
  ).rejects.toMatchObject({ status: 401 });
});

test('rejects an authenticated member', async () => {
  await expect(
    requireActiveOwner({
      getCurrentUser: async () => ({ id: 'member-id' }),
      findAllowedUser: async () => ({ role: 'member', status: 'active' }),
    }),
  ).rejects.toMatchObject({ status: 403 });
});

test('returns the authenticated id for an active owner', async () => {
  await expect(
    requireActiveOwner({
      getCurrentUser: async () => ({ id: 'owner-id' }),
      findAllowedUser: async () => ({ role: 'owner', status: 'active' }),
    }),
  ).resolves.toEqual({ userId: 'owner-id' });
});
