import { expect, test } from 'vitest';
import { handleAuthCallback } from '@/lib/auth/callback';

const userId = 'c2fa7f5b-b00d-4efb-934d-932a1c65d48e';

test('active allowlist member callback writes a profile', async () => {
  let savedProfile: { id: string; user_id: string; email: string } | undefined;

  const response = await handleAuthCallback({
    userId,
    email: 'member@example.com',
    findActiveAllowedUser: async () => true,
    signOut: async () => {
      throw new Error('active member must not be signed out');
    },
    upsertProfile: async (profile) => {
      savedProfile = profile;
    },
  });

  expect(savedProfile).toEqual({ id: userId, user_id: userId, email: 'member@example.com' });
  expect(response.headers.get('location')).toBe('http://localhost/');
});

test('revoked allowlist member callback signs out', async () => {
  let signedOut = false;

  const response = await handleAuthCallback({
    userId,
    email: 'member@example.com',
    findActiveAllowedUser: async () => false,
    signOut: async () => {
      signedOut = true;
    },
  });

  expect(signedOut).toBe(true);
  expect(response.headers.get('location')).toContain('/login?error=unauthorized');
});
