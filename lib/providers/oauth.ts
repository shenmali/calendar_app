import { createHash, randomBytes } from 'node:crypto';

import { providerScopes, type OAuthProvider } from '@/lib/providers/types';

export function oauthRedirectUri(provider: OAuthProvider): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!configuredUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is required');
  }

  let appUrl: URL;
  try {
    appUrl = new URL(configuredUrl);
  } catch {
    throw new Error('NEXT_PUBLIC_APP_URL must be a valid absolute URL');
  }
  if (appUrl.protocol !== 'https:' && appUrl.hostname !== 'localhost') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS outside localhost');
  }

  return new URL(`/api/connections/${provider}/callback`, appUrl).toString();
}

export function appUrl(): URL {
  const googleCallback = new URL(oauthRedirectUri('google'));
  return new URL('/', googleCallback);
}

export function oauthClientCredentials(provider: OAuthProvider): { clientId: string; clientSecret: string } {
  const prefix = provider === 'google' ? 'GOOGLE' : 'MICROSOFT';
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) {
    throw new Error(`${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET are required`);
  }

  return { clientId, clientSecret };
}

export function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(48).toString('base64url');
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

export function scopeFor(provider: OAuthProvider): string {
  return providerScopes[provider].join(' ');
}
