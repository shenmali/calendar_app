declare module '@/scripts/provision-owner-lib.mjs' {
  type AuthUser = { id: string; email?: string | null };

  export function provisionOwner(input: {
    ownerEmail: string | undefined;
    listUsers: () => Promise<AuthUser[]>;
    createUser: (input: { email: string; email_confirm: true }) => Promise<AuthUser>;
    upsertAllowedUser: (input: {
      user_id: string;
      email: string;
      role: 'owner';
      status: 'active';
      revoked_at: null;
    }) => Promise<void>;
  }): Promise<{ createdAuthUser: boolean }>;
}
