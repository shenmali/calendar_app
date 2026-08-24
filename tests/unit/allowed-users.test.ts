import { expect, test } from 'vitest';
import {
  isActiveAllowedUser,
  isOwner,
  normalizeEmail,
} from '@/lib/access/allowed-users';

test('normalizes an allowlist email', () => {
  expect(normalizeEmail('  OWNER@Example.COM ')).toBe('owner@example.com');
});

test('accepts only active allowlist records', () => {
  expect(isActiveAllowedUser({ status: 'active' })).toBe(true);
  expect(isActiveAllowedUser({ status: 'revoked' })).toBe(false);
});

test('recognizes only active owners as administrators', () => {
  expect(isOwner({ role: 'owner', status: 'active' })).toBe(true);
  expect(isOwner({ role: 'member', status: 'active' })).toBe(false);
  expect(isOwner({ role: 'owner', status: 'revoked' })).toBe(false);
});
