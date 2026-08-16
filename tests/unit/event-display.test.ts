import { expect, test } from 'vitest';

import { formatEventTimeRange, formatSyncStatus } from '@/lib/calendar/event-display';

test('formats the full Istanbul-local start and end range for a timed event', () => {
  expect(formatEventTimeRange({ startsAt: '2026-01-15T07:00:00.000Z', endsAt: '2026-01-15T09:30:00.000Z', isAllDay: false })).toBe('10:00–12:30');
});

test('keeps all-day events explicit', () => {
  expect(formatEventTimeRange({ startsAt: '2026-01-15', endsAt: '2026-01-16', isAllDay: true })).toBe('Tüm gün');
});

test('includes Istanbul dates when a timed event crosses a local date boundary', () => {
  expect(formatEventTimeRange({ startsAt: '2026-01-15T20:30:00.000Z', endsAt: '2026-01-16T00:30:00.000Z', isAllDay: false })).toBe('15.01 23:30–16.01 03:30');
});

test('keeps the persisted sync timestamp visible beside a temporary result state', () => {
  expect(formatSyncStatus('partial', '2026-01-02T03:04:00.000Z')).toBe('Bazı takvimler eşitlenemedi. Son eşitleme: 02.01.2026 06:04');
});
