import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { UserManagementPanel } from '@/components/users/user-management-panel';

const users = [
  { id: 'owner-row', email: 'owner@example.com', role: 'owner' as const, status: 'active' as const, created_at: '2026-08-17T00:00:00.000Z', revoked_at: null },
  { id: 'member-row', email: 'member@example.com', role: 'member' as const, status: 'revoked' as const, created_at: '2026-08-17T00:00:00.000Z', revoked_at: '2026-08-17T01:00:00.000Z' },
];

test('owner sees controls to add and restore members', () => {
  const markup = renderToStaticMarkup(createElement(UserManagementPanel, { initialUsers: users }));

  expect(markup).toContain('E-posta');
  expect(markup).toContain('Ekle');
  expect(markup).toContain('Erişimi aç');
});

test('owner rows do not have a revoke control', () => {
  const markup = renderToStaticMarkup(createElement(UserManagementPanel, { initialUsers: users }));

  expect(markup).not.toContain('owner-row-revoke');
  expect(markup).toContain('member-row-restore');
});
