import { expect, test } from 'vitest';
import { createMagicLinkOptions } from '@/lib/auth/magic-link';

test('magic link isteği yeni kullanıcı oluşturmayı kapatır', () => {
  expect(createMagicLinkOptions('https://calendar.example.com')).toEqual({
    shouldCreateUser: false,
    emailRedirectTo: 'https://calendar.example.com/auth/callback',
  });
});
