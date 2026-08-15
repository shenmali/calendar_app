import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function encryptionKey(): Buffer {
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

function decodeSegment(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error('Invalid encrypted token format');
  }

  const decoded = Buffer.from(value, 'base64');
  if (decoded.length === 0 || decoded.toString('base64') !== value) {
    throw new Error('Invalid encrypted token format');
  }

  return decoded;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

export function decryptToken(cipher: string): string {
  const segments = cipher.split('.');
  if (segments.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivSegment, tagSegment, ciphertextSegment] = segments;
  const iv = decodeSegment(ivSegment);
  const tag = decodeSegment(tagSegment);
  const ciphertext = decodeSegment(ciphertextSegment);
  if (iv.length !== IV_BYTES || tag.length !== AUTH_TAG_BYTES) {
    throw new Error('Invalid encrypted token format');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Invalid encrypted token value');
  }
}
