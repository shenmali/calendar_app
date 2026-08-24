import { expect, test } from 'vitest';

import { createEmailOtpOptions } from '@/lib/auth/email-otp';

test('keeps emailed verification codes restricted to existing users', () => {
  expect(createEmailOtpOptions()).toEqual({ shouldCreateUser: false });
});
