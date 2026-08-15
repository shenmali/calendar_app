import { afterEach, expect, test, vi } from 'vitest';

import { consumeOAuthState, createOAuthState, verifyOAuthState } from '@/lib/providers/oauth-state';

afterEach(() => {
  vi.unstubAllEnvs();
});

test('issues a signed state bound to its user and provider', () => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64'));
  const now = 1_700_000_000_000;
  const state = createOAuthState({ userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca', provider: 'google', now });

  expect(
    verifyOAuthState({
      state: state.value,
      cookieState: state.value,
      userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca',
      provider: 'google',
      now: now + 1,
    }),
  ).toEqual({ userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca', provider: 'google' });
});

test('rejects a state reused without its matching one-time cookie', () => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64'));
  const state = createOAuthState({ userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca', provider: 'microsoft', now: 1_700_000_000_000 });

  expect(() =>
    verifyOAuthState({
      state: state.value,
      cookieState: undefined,
      userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca',
      provider: 'microsoft',
      now: 1_700_000_000_001,
    }),
  ).toThrow('Invalid OAuth state');
});

test('rejects a state for another provider, user, or expired timestamp', () => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64'));
  const state = createOAuthState({ userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca', provider: 'google', now: 1_700_000_000_000 });

  expect(() =>
    verifyOAuthState({
      state: state.value,
      cookieState: state.value,
      userId: 'a3c7a5d6-7c30-4ccb-aa8f-5339aa6b6e4b',
      provider: 'google',
      now: 1_700_000_000_001,
    }),
  ).toThrow('Invalid OAuth state');
  expect(() =>
    verifyOAuthState({
      state: state.value,
      cookieState: state.value,
      userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca',
      provider: 'microsoft',
      now: 1_700_000_000_001,
    }),
  ).toThrow('Invalid OAuth state');
  expect(() =>
    verifyOAuthState({
      state: state.value,
      cookieState: state.value,
      userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca',
      provider: 'google',
      now: 1_700_000_601_000,
    }),
  ).toThrow('OAuth state expired');
});

test('rejects a duplicate callback even when it presents the original matching state cookie', async () => {
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', Buffer.alloc(32, 3).toString('base64'));
  const state = createOAuthState({ userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca', provider: 'google', now: 1_700_000_000_000 });
  const consumedNonces = new Set<string>();
  const consumeNonce = async (nonce: string) => {
    if (consumedNonces.has(nonce)) return false;
    consumedNonces.add(nonce);
    return true;
  };
  const input = {
    state: state.value,
    cookieState: state.value,
    userId: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca',
    provider: 'google' as const,
    now: 1_700_000_000_001,
    consumeNonce,
  };

  await expect(consumeOAuthState(input)).resolves.toEqual({ userId: input.userId, provider: 'google' });
  await expect(consumeOAuthState(input)).rejects.toThrow('Invalid OAuth state');
});
