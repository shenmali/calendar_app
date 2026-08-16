export const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
] as const;

export const TURKISH_WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

export type DayModel = {
  weekday: (typeof TURKISH_WEEKDAYS)[number];
  date: string | null;
};

export type MonthModel = {
  month: number;
  label: string;
  weeks: DayModel[][];
};

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Builds an environment-independent, Monday-first month grid using UTC dates only. */
export function buildYearMonths(year: number, weekStartsOn: 1): MonthModel[] {
  if (weekStartsOn !== 1) throw new Error('Only Monday-first calendars are supported');

  return Array.from({ length: 12 }, (_, month): MonthModel => {
    const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells: DayModel[] = Array.from({ length: firstWeekday }, (_, index) => ({
      weekday: TURKISH_WEEKDAYS[index],
      date: null,
    }));

    for (let day = 1; day <= daysInMonth; day += 1) {
      const index = firstWeekday + day - 1;
      cells.push({ weekday: TURKISH_WEEKDAYS[index % 7], date: isoDate(year, month, day) });
    }

    while (cells.length % 7 !== 0) {
      const index = cells.length % 7;
      cells.push({ weekday: TURKISH_WEEKDAYS[index], date: null });
    }

    const weeks = Array.from({ length: cells.length / 7 }, (_, index) => cells.slice(index * 7, index * 7 + 7));
    return { month, label: `${TURKISH_MONTHS[month]} ${year}`, weeks };
  });
}
