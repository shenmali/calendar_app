import { expect, test } from 'vitest';

import { buildYearMonths } from '@/lib/calendar/year-grid';

test('builds twelve Turkish months for 2026 with Monday as the first weekday', () => {
  const months = buildYearMonths(2026, 1);

  expect(months).toHaveLength(12);
  expect(months[0]).toMatchObject({ month: 0, label: 'Ocak 2026' });
  expect(months[0].weeks[0][0]).toEqual({ weekday: 'Pzt', date: null });
  expect(months[0].weeks[0][3]).toEqual({ weekday: 'Per', date: '2026-01-01' });
  expect(months[11].label).toBe('Aralık 2026');
});

test('keeps every generated day inside its own month', () => {
  const february = buildYearMonths(2026, 1)[1];
  const dates = february.weeks.flat().flatMap((day) => day.date ? [day.date] : []);

  expect(dates).toHaveLength(28);
  expect(dates[0]).toBe('2026-02-01');
  expect(dates.at(-1)).toBe('2026-02-28');
});

test('anchors the annual rail at the selected month while retaining every month', () => {
  const buildFromSelectedMonth = buildYearMonths as unknown as (year: number, weekStartsOn: 1, selectedMonth: number) => ReturnType<typeof buildYearMonths>;
  const months = buildFromSelectedMonth(2026, 1, 7);

  expect(months.map((month) => month.month)).toEqual([7, 8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6]);
  expect(months[0].label).toBe('Ağustos 2026');
  expect(months.at(-1)?.label).toBe('Temmuz 2026');
});
