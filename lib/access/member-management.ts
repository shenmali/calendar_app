import { normalizeEmail } from '@/lib/access/allowed-users';

export type SafeAllowedUser = {
  id: string;
  email: string;
  role: 'owner' | 'member';
  status: 'active' | 'revoked';
  created_at?: string;
  revoked_at?: string | null;
};

export async function addOrRestoreMember({
  email,
  findAuthUserByEmail,
  createAuthUser,
  upsertMember,
}: {
  email: string;
  findAuthUserByEmail: (email: string) => Promise<{ id: string } | null>;
  createAuthUser: (input: { email: string; email_confirm: true }) => Promise<{ id: string }>;
  upsertMember: (input: {
    user_id: string;
    email: string;
    role: 'member';
    status: 'active';
    revoked_at: null;
  }) => Promise<SafeAllowedUser>;
}) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await findAuthUserByEmail(normalizedEmail);
  const authUser = existingUser ?? await createAuthUser({
    email: normalizedEmail,
    email_confirm: true,
  });

  return upsertMember({
    user_id: authUser.id,
    email: normalizedEmail,
    role: 'member',
    status: 'active',
    revoked_at: null,
  });
}

export async function changeMemberStatus({
  currentOwnerUserId,
  target,
  status,
  updateStatus,
  setAuthenticationAccess,
}: {
  currentOwnerUserId: string;
  target: { id: string; user_id: string; role: 'owner' | 'member'; status: 'active' | 'revoked' };
  status: 'active' | 'revoked';
  updateStatus: (id: string, status: 'active' | 'revoked') => Promise<unknown>;
  setAuthenticationAccess: (userId: string, status: 'active' | 'revoked') => Promise<void>;
}) {
  if (target.user_id === currentOwnerUserId || target.role === 'owner') {
    throw new Error('Owners cannot be revoked.');
  }

  const result = await updateStatus(target.id, status);
  await setAuthenticationAccess(target.user_id, status);

  return result;
}
