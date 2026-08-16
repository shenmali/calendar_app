import { MonthCard } from '@/components/calendar/month-card';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';
import type { MonthModel } from '@/lib/calendar/year-grid';

type MonthViewProps = {
  month: MonthModel;
  eventsByDay: Map<string, CalendarDisplayEvent[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

export function MonthView({ month, eventsByDay, selectedDate, onSelectDate }: MonthViewProps) {
  return (
    <section aria-label="Aylık görünüm" data-testid="month-view">
      <MonthCard eventsByDay={eventsByDay} month={month} onSelectDate={onSelectDate} selectedDate={selectedDate} />
    </section>
  );
}
