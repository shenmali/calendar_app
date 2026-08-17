import { expect, test, vi } from 'vitest';
import {
  addOrRestoreMember,
  changeMemberStatus,
} from '@/lib/access/member-management';

test('adds a normalized member with an email-confirmed auth account', async () => {
  const createAuthUser = vi.fn().mockResolvedValue({ id: 'member-id' });
  const upsertMember = vi.fn().mockResolvedValue({
    id: 'member-row', email: 'member@example.com', role: 'member', status: 'active',
    created_at: '2026-08-17T00:00:00.000Z', revoked_at: null,
  });

  const member = await addOrRestoreMember({
    email: ' Member@Example.com ',
    findAuthUserByEmail: async () => null,
    createAuthUser,
    upsertMember,
  });

  expect(createAuthUser).toHaveBeenCalledWith({ email: 'member@example.com', email_confirm: true });
  expect(member).toEqual(expect.objectContaining({ email: 'member@example.com', role: 'member' }));
});

test('revokes a member and disables future Auth sessions without deleting calendar data', async () => {
  const setAuthenticationAccess = vi.fn().mockResolvedValue(undefined);
  const updateStatus = vi.fn().mockResolvedValue({ id: 'member-row', status: 'revoked' });

  await changeMemberStatus({
    currentOwnerUserId: 'owner-id',
    target: { id: 'member-row', user_id: 'member-id', role: 'member', status: 'active' },
    status: 'revoked',
    updateStatus,
    setAuthenticationAccess,
  });

  expect(updateStatus).toHaveBeenCalledWith('member-row', 'revoked');
  expect(setAuthenticationAccess).toHaveBeenCalledWith('member-id', 'revoked');
});

test('restores a member and re-enables Auth access', async () => {
  const setAuthenticationAccess = vi.fn().mockResolvedValue(undefined);

  await changeMemberStatus({
    currentOwnerUserId: 'owner-id',
    target: { id: 'member-row', user_id: 'member-id', role: 'member', status: 'revoked' },
    status: 'active',
    updateStatus: vi.fn().mockResolvedValue({ id: 'member-row', status: 'active' }),
    setAuthenticationAccess,
  });

  expect(setAuthenticationAccess).toHaveBeenCalledWith('member-id', 'active');
});

test('does not allow an owner to revoke self or another owner', async () => {
  const input = {
    currentOwnerUserId: 'owner-id',
    status: 'revoked' as const,
    updateStatus: vi.fn(),
    setAuthenticationAccess: vi.fn(),
  };

  await expect(changeMemberStatus({
    ...input,
    target: { id: 'owner-row', user_id: 'owner-id', role: 'owner', status: 'active' },
  })).rejects.toThrow('Owners cannot be revoked.');
});
