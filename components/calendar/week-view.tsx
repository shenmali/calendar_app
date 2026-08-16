import { eventDateInIstanbul } from '@/lib/calendar/event-selectors';
import { TURKISH_WEEKDAYS } from '@/lib/calendar/year-grid';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type WeekViewProps = {
  events: CalendarDisplayEvent[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

function weekDates(date: string): string[] {
  const [year, month, day] = date.split('-').map(Number);
  const selected = new Date(Date.UTC(year, month - 1, day));
  const mondayOffset = (selected.getUTCDay() + 6) % 7;
  selected.setUTCDate(selected.getUTCDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(selected);
    value.setUTCDate(selected.getUTCDate() + index);
    return value.toISOString().slice(0, 10);
  });
}

export function WeekView({ events, selectedDate, onSelectDate }: WeekViewProps) {
  const dates = weekDates(selectedDate);
  return (
    <section aria-label="Haftalık görünüm" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7" data-testid="week-view">
      {dates.map((date, index) => {
        const dayEvents = events.filter((event) => eventDateInIstanbul(event) === date);
        return (
          <button aria-pressed={date === selectedDate} className="min-h-11 rounded-lg border border-slate-200 bg-white p-3 text-left hover:bg-sky-50" key={date} onClick={() => onSelectDate(date)} type="button">
            <span className="block text-xs font-semibold text-sky-700">{TURKISH_WEEKDAYS[index]}</span>
            <span className="block text-sm font-semibold">{date.slice(-2)}</span>
            <span className="mt-2 block text-xs text-slate-500">{dayEvents.length ? `${dayEvents.length} etkinlik` : 'Etkinlik yok'}</span>
          </button>
        );
      })}
    </section>
  );
}
