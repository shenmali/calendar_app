import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { LoginForm } from '@/components/auth/login-form';

test('starts the passwordless flow by requesting an email verification code', () => {
  globalThis.React = React;
  const markup = renderToStaticMarkup(React.createElement(LoginForm));

  expect(markup).toContain('Kod gönder');
  expect(markup).not.toContain('Magic link gönder');
});
