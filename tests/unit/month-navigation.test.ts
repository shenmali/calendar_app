import * as daySelection from '@/lib/calendar/day-selection';
import { expect, test } from 'vitest';

test('moves the active month one step and clamps dates that do not exist in the target month', () => {
  const navigation = daySelection as typeof daySelection & {
    moveCalendarMonth?: (date: string, amount: number) => string;
  };

  expect(navigation.moveCalendarMonth?.('2026-03-31', -1)).toBe('2026-02-28');
});
