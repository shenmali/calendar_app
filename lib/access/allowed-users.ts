export type AllowedUserStatus = 'active' | 'revoked';
export type AllowedUserRole = 'owner' | 'member';

export function normalizeEmail(email: string) {
  return email.trim().toLocaleLowerCase('en-US');
}

export function isActiveAllowedUser(row: { status: string }) {
  return row.status === 'active';
}

export function isOwner(row: { role: string; status: string }) {
  return row.role === 'owner' && isActiveAllowedUser(row);
}
