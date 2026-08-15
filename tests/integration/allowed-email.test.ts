import { expect, test } from 'vitest';
import { isAllowedEmail } from '@/lib/security/allowed-email';

test('yalnızca izinli e-posta kabul edilir', () => {
  expect(isAllowedEmail('owner@example.com', 'owner@example.com')).toBe(true);
  expect(isAllowedEmail('other@example.com', 'owner@example.com')).toBe(false);
});
