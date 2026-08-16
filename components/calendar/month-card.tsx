import { DayCell } from '@/components/calendar/day-cell';
import { TURKISH_WEEKDAYS, type MonthModel } from '@/lib/calendar/year-grid';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type MonthCardProps = {
  month: MonthModel;
  eventsByDay: Map<string, CalendarDisplayEvent[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

export function MonthCard({ month, eventsByDay, selectedDate, onSelectDate }: MonthCardProps) {
  return (
    <section aria-labelledby={`month-${month.month}`} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800" id={`month-${month.month}`}>{month.label}</h2>
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {TURKISH_WEEKDAYS.map((weekday) => <span className="py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500" key={weekday}>{weekday}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {month.weeks.flat().map((day, index) => (
          <DayCell date={day.date} events={day.date ? eventsByDay.get(day.date) ?? [] : []} isSelected={day.date === selectedDate} key={day.date ?? `${month.month}-empty-${index}`} onSelect={onSelectDate} />
        ))}
      </div>
    </section>
  );
}
