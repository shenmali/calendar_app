import { afterEach, expect, test, vi } from 'vitest';

import { decryptToken, encryptToken } from '@/lib/security/token-crypto';

afterEach(() => {
  vi.unstubAllEnvs();
});

test('token encryption is reversible without retaining its plaintext', () => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));

  const encrypted = encryptToken('refresh-secret');

  expect(encrypted).not.toContain('refresh-secret');
  expect(encrypted.split('.')).toHaveLength(3);
  expect(decryptToken(encrypted)).toBe('refresh-secret');
});

test('rejects an encryption key that is not exactly 32 bytes after base64 decoding', () => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(31, 7).toString('base64'));

  expect(() => encryptToken('refresh-secret')).toThrow('TOKEN_ENCRYPTION_KEY');
});

test('rejects malformed encrypted token values', () => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 7).toString('base64'));

  expect(() => decryptToken('not-a-token')).toThrow('Invalid encrypted token format');
});
