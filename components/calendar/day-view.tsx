import { EventDetailPanel } from '@/components/calendar/event-detail-panel';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type DayViewProps = { date: string; events: CalendarDisplayEvent[] };

export function DayView({ date, events }: DayViewProps) {
  return (
    <section aria-label="Günlük görünüm" data-testid="day-view">
      <EventDetailPanel date={date} events={events} />
    </section>
  );
}
