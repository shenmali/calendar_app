import { expect, test } from 'vitest';

import { allDayOverlapsRange, isoInstant } from '@/lib/calendar/time';

test('converts an offset-less IANA calendar time independently of the host timezone', () => {
  expect(isoInstant('2026-08-15T10:00:00', 'Europe/Istanbul')).toBe('2026-08-15T07:00:00.000Z');
});

test('does not select a previous Istanbul all-day event ending at the range start', () => {
  expect(allDayOverlapsRange({
    startsAt: '2026-08-13T21:00:00.000Z', endsAt: '2026-08-14T21:00:00.000Z',
  }, {
    start: '2026-08-14T21:00:00.000Z', end: '2026-08-15T21:00:00.000Z',
  }, 'Europe/Istanbul')).toBe(false);
});
