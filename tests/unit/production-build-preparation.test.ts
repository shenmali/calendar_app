import { expect, test } from 'vitest';

import { shouldPrepareProductionBuild } from '@/scripts/prepare-production-build-lib.mjs';

test('prepares the owner only for a Vercel production build', () => {
  expect(shouldPrepareProductionBuild({ VERCEL: '1', VERCEL_ENV: 'production' })).toBe(true);
  expect(shouldPrepareProductionBuild({ VERCEL: '1', VERCEL_ENV: 'preview' })).toBe(false);
  expect(shouldPrepareProductionBuild({ VERCEL_ENV: 'production' })).toBe(false);
});
