import type { DateRange } from '@/lib/calendar/types';
import type { CalendarView } from '@/components/calendar/view-switcher';

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function activeExportRange(view: CalendarView, selectedDate: string, year: number): DateRange {
  if (view === 'year') return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
  if (view === 'day') return { start: selectedDate, end: addDays(selectedDate, 1) };
  if (view === 'month') {
    const start = `${selectedDate.slice(0, 7)}-01`;
    return { start, end: addDays(start, 32).slice(0, 7) + '-01' };
  }
  const weekday = new Date(`${selectedDate}T00:00:00.000Z`).getUTCDay();
  const start = addDays(selectedDate, weekday === 0 ? -6 : 1 - weekday);
  return { start, end: addDays(start, 7) };
}
