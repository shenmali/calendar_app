import React from 'react';

import { eventDateInIstanbul, eventsForDay } from '@/lib/calendar/event-selectors';
import { TURKISH_MONTHS } from '@/lib/calendar/year-grid';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type DayCellProps = {
  date: string | null;
  events: CalendarDisplayEvent[];
  isSelected: boolean;
  onSelect: (date: string) => void;
};

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${TURKISH_MONTHS[month - 1]} ${year}`;
}

export function DayCell({ date, events, isSelected, onSelect }: DayCellProps) {
  if (!date) return <div aria-hidden="true" className="h-11 min-h-11 border-b border-r border-dashed border-slate-100 bg-slate-100/60 sm:h-16 sm:min-h-16" />;

  const { visible, remaining } = eventsForDay(events);
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const isToday = date === eventDateInIstanbul({ startsAt: new Date().toISOString(), isAllDay: false });

  return (
    <button
      aria-label={`${dateLabel(date)} gününü seç`}
      aria-pressed={isSelected}
      className={`h-11 min-h-11 overflow-hidden border-b border-r border-slate-100 p-1 text-left align-top transition hover:bg-sky-50 sm:h-16 sm:min-h-16 ${isWeekend ? 'bg-slate-50' : 'bg-white'} ${isSelected ? 'ring-2 ring-inset ring-sky-600' : ''}`}
      onClick={() => onSelect(date)}
      type="button"
    >
      <span className={`mb-0.5 block w-fit text-xs font-semibold tabular-nums ${isWeekend ? 'text-slate-500' : 'text-slate-600'} ${isToday ? 'rounded-full px-1 outline outline-1 outline-sky-600' : ''}`}>{Number(date.slice(-2))}</span>
      <span className="sm:hidden" aria-label={`${events.length} etkinlik`}>
        {events.slice(0, 3).map((event) => <span aria-hidden="true" className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full" key={event.id} style={{ backgroundColor: event.sourceColor ?? '#0284c7' }} />)}
        {events.length ? <span className="text-[10px] font-semibold text-sky-800">{events.length}</span> : null}
      </span>
      <span className="hidden sm:block">
      {visible.map((event) => (
        <span className="mb-0.5 flex items-center gap-1 truncate rounded px-0.5 text-[10px] leading-3 text-slate-700" key={event.id} aria-label={`Etkinlik: ${event.title}`}>
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: event.sourceColor ?? '#0284c7' }} />
          <span className="truncate">{event.title}</span>
        </span>
      ))}
      {remaining > 0 ? <span className="block text-[10px] font-semibold text-sky-800">+{remaining}</span> : null}
      </span>
    </button>
  );
}
