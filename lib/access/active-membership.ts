import { isActiveAllowedUser } from '@/lib/access/allowed-users';

export async function hasActiveMembership({
  userId,
  findAllowedUser,
}: {
  userId: string;
  findAllowedUser: (userId: string) => Promise<{ status: string } | null>;
}) {
  const membership = await findAllowedUser(userId);
  return Boolean(membership && isActiveAllowedUser(membership));
}
