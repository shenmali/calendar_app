import { expect, test } from 'vitest';

import { hasActiveMembership } from '@/lib/access/active-membership';

test('accepts only an active membership for the authenticated user', async () => {
  await expect(hasActiveMembership({
    userId: 'user-id',
    findAllowedUser: async (userId) => userId === 'user-id' ? { status: 'active' } : null,
  })).resolves.toBe(true);
});

test('rejects a revoked or missing membership', async () => {
  await expect(hasActiveMembership({
    userId: 'user-id',
    findAllowedUser: async () => ({ status: 'revoked' }),
  })).resolves.toBe(false);
});
