import { expect, test } from 'vitest';

import { validateDeploymentEnvironment } from '@/scripts/deployment-preflight.mjs';

const validEnvironment = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://calendar.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  OWNER_EMAIL: 'owner@example.com',
  TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  MICROSOFT_CLIENT_ID: 'microsoft-client-id',
  MICROSOFT_CLIENT_SECRET: 'microsoft-client-secret',
  CRON_SECRET: 'Cron-secret-0123456789',
  NEXT_PUBLIC_APP_URL: 'https://calendar.example.com',
};

test('reports missing required deployment environment names without echoing their values', () => {
  const issues = validateDeploymentEnvironment({
    ...validEnvironment,
    GOOGLE_CLIENT_SECRET: '',
    CRON_SECRET: undefined,
  });

  expect(issues).toEqual([
    'Missing required environment variable: GOOGLE_CLIENT_SECRET',
    'Missing required environment variable: CRON_SECRET',
  ]);
  expect(issues.join('\n')).not.toContain('google-client-secret');
});

test('rejects an encryption key that is not canonical base64 for exactly 32 bytes', () => {
  const issues = validateDeploymentEnvironment({
    ...validEnvironment,
    TOKEN_ENCRYPTION_KEY: Buffer.alloc(31, 1).toString('base64'),
  });

  expect(issues).toEqual([
    'TOKEN_ENCRYPTION_KEY must be a canonical base64-encoded 32-byte key',
  ]);
});

test('accepts a complete deployment environment with a 32-byte encryption key', () => {
  expect(validateDeploymentEnvironment(validEnvironment)).toEqual([]);
});

test('rejects a trivial cron secret even when it has the minimum length', () => {
  const issues = validateDeploymentEnvironment({
    ...validEnvironment,
    CRON_SECRET: 'aaaaaaaaaaaaaaaa',
  });

  expect(issues).toEqual([
    'CRON_SECRET must be at least 16 characters and include three character classes',
  ]);
});
