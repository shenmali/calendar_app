import { expect, test } from 'vitest';
import { handleAuthCallback } from '@/lib/auth/callback';

test('izin verilmeyen e-posta callback sonrasında oturumu kapatır ve girişe yönlendirir', async () => {
  let signedOut = false;

  const response = await handleAuthCallback({
    email: 'other@example.com',
    findActiveAllowedUser: async () => false,
    signOut: async () => {
      signedOut = true;
    },
  });

  expect(signedOut).toBe(true);
  expect(response.headers.get('location')).toContain('/login?error=unauthorized');
});

test('izin verilen kullanıcı için profil satırını yazıp uygulamaya yönlendirir', async () => {
  let savedProfile: { id: string; user_id: string; email: string } | undefined;

  const response = await handleAuthCallback({
    userId: 'c2fa7f5b-b00d-4efb-934d-932a1c65d48e',
    email: 'owner@example.com',
    findActiveAllowedUser: async () => true,
    signOut: async () => {
      throw new Error('izin verilen kullanıcı çıkış yapmamalı');
    },
    upsertProfile: async (profile) => {
      savedProfile = profile;
    },
  });

  expect(savedProfile).toEqual({
    id: 'c2fa7f5b-b00d-4efb-934d-932a1c65d48e',
    user_id: 'c2fa7f5b-b00d-4efb-934d-932a1c65d48e',
    email: 'owner@example.com',
  });
  expect(response.headers.get('location')).toBe('http://localhost/');
});

test('doğrulanmış kullanıcı kimliği yoksa callback erişimi reddeder', async () => {
  let signedOut = false;

  const response = await handleAuthCallback({
    email: 'owner@example.com',
    findActiveAllowedUser: async () => true,
    signOut: async () => {
      signedOut = true;
    },
  });

  expect(signedOut).toBe(true);
  expect(response.headers.get('location')).toContain('/login?error=unauthorized');
});

test('profil yazımı başarısız olursa oturumu kapatır ve erişim vermez', async () => {
  let signedOut = false;

  const response = await handleAuthCallback({
    userId: 'c2fa7f5b-b00d-4efb-934d-932a1c65d48e',
    email: 'owner@example.com',
    findActiveAllowedUser: async () => true,
    signOut: async () => {
      signedOut = true;
    },
    upsertProfile: async () => {
      throw new Error('database unavailable');
    },
  });

  expect(signedOut).toBe(true);
  expect(response.headers.get('location')).toContain('/login?error=auth_callback');
});
