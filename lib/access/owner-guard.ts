import { isOwner } from '@/lib/access/allowed-users';

export class AccessError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? 'Authentication required.' : 'Owner access required.');
  }
}

export async function requireActiveOwner({
  getCurrentUser,
  findAllowedUser,
}: {
  getCurrentUser: () => Promise<{ id: string } | null>;
  findAllowedUser: (userId: string) => Promise<{ role: string; status: string } | null>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    throw new AccessError(401);
  }

  const allowedUser = await findAllowedUser(user.id);
  if (!allowedUser || !isOwner(allowedUser)) {
    throw new AccessError(403);
  }

  return { userId: user.id };
}
