import { expect, test } from 'vitest';

import { formatEventTimeRange } from '@/lib/calendar/event-display';

test('formats the full Istanbul-local start and end range for a timed event', () => {
  expect(formatEventTimeRange({
    startsAt: '2026-01-15T07:00:00.000Z', endsAt: '2026-01-15T09:30:00.000Z', isAllDay: false,
  })).toBe('10:00–12:30');
});

test('keeps all-day events explicit', () => {
  expect(formatEventTimeRange({ startsAt: '2026-01-15', endsAt: '2026-01-16', isAllDay: true })).toBe('Tüm gün');
});
