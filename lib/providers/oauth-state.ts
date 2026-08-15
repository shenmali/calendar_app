import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { OAuthProvider } from '@/lib/providers/types';

const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthStatePayload = {
  exp: number;
  nonce: string;
  provider: OAuthProvider;
  userId: string;
};

type StateInput = {
  provider: OAuthProvider;
  userId: string;
  now?: number;
};

type StateVerificationInput = StateInput & {
  cookieState: string | undefined;
  state: string;
};

type StateConsumptionInput = StateVerificationInput & {
  consumeNonce: (nonce: string) => Promise<boolean>;
};

function base64Url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function signingKey(): Buffer {
  const encodedKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encodedKey || !/^[A-Za-z0-9+/]+={0,2}$/.test(encodedKey) || encodedKey.length % 4 !== 0) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }

  const key = Buffer.from(encodedKey, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encodedKey) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  }

  return key;
}

function sign(payload: string): string {
  return base64Url(createHmac('sha256', signingKey()).update(payload).digest());
}

function invalidState(): never {
  throw new Error('Invalid OAuth state');
}

export function oauthStateCookieName(provider: OAuthProvider): string {
  return `oauth_state_${provider}`;
}

export function createOAuthState({ userId, provider, now = Date.now() }: StateInput): { value: string; nonce: string; expiresAt: Date } {
  const expiresAt = new Date(now + STATE_TTL_MS);
  const nonce = base64Url(randomBytes(32));
  const payload: OAuthStatePayload = {
    userId,
    provider,
    exp: expiresAt.getTime(),
    nonce,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));

  return { value: `${encodedPayload}.${sign(encodedPayload)}`, nonce, expiresAt };
}

export function verifyOAuthState({
  state,
  cookieState,
  userId,
  provider,
  now = Date.now(),
}: StateVerificationInput): Pick<OAuthStatePayload, 'userId' | 'provider'> {
  if (!cookieState || cookieState !== state) {
    return invalidState();
  }

  const parts = state.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return invalidState();
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return invalidState();
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OAuthStatePayload;
  } catch {
    return invalidState();
  }

  if (
    !payload.nonce ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= now ||
    payload.userId !== userId ||
    payload.provider !== provider
  ) {
    if (Number.isInteger(payload.exp) && payload.exp <= now) {
      throw new Error('OAuth state expired');
    }
    return invalidState();
  }

  return { userId: payload.userId, provider: payload.provider };
}

export async function consumeOAuthState(input: StateConsumptionInput): Promise<Pick<OAuthStatePayload, 'userId' | 'provider'>> {
  const verified = verifyOAuthState(input);
  const [encodedPayload] = input.state.split('.');
  const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OAuthStatePayload;

  if (!(await input.consumeNonce(payload.nonce))) {
    return invalidState();
  }

  return verified;
}
