import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const requiredDeploymentEnvironmentVariables = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ALLOWED_EMAIL',
  'TOKEN_ENCRYPTION_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'MICROSOFT_CLIENT_ID',
  'MICROSOFT_CLIENT_SECRET',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
];

function isCanonicalBase64Key(value) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return false;

  const key = Buffer.from(value, 'base64');
  return key.length === 32 && key.toString('base64') === value;
}

function isStrongCronSecret(value) {
  if (value.length < 16) return false;

  return [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/]
    .filter((characterClass) => characterClass.test(value)).length >= 3;
}

/**
 * Returns diagnostics containing only configuration names, never their values.
 */
export function validateDeploymentEnvironment(environment) {
  const issues = requiredDeploymentEnvironmentVariables
    .filter((name) => !environment[name]?.trim())
    .map((name) => `Missing required environment variable: ${name}`);

  const encryptionKey = environment.TOKEN_ENCRYPTION_KEY;
  if (encryptionKey?.trim() && !isCanonicalBase64Key(encryptionKey)) {
    issues.push('TOKEN_ENCRYPTION_KEY must be a canonical base64-encoded 32-byte key');
  }

  const cronSecret = environment.CRON_SECRET;
  if (cronSecret?.trim() && !isStrongCronSecret(cronSecret)) {
    issues.push('CRON_SECRET must be at least 16 characters and include three character classes');
  }

  return issues;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const issues = validateDeploymentEnvironment(process.env);
  if (issues.length > 0) {
    console.error('Deployment preflight failed:');
    for (const issue of issues) console.error(`- ${issue}`);
    process.exitCode = 1;
  } else {
    console.log('Deployment preflight passed. Required environment names are configured.');
  }
}
