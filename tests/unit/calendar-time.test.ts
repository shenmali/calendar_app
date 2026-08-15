import { expect, test } from 'vitest';

import { isoInstant } from '@/lib/calendar/time';

test('converts an offset-less IANA calendar time independently of the host timezone', () => {
  expect(isoInstant('2026-08-15T10:00:00', 'Europe/Istanbul')).toBe('2026-08-15T07:00:00.000Z');
});
