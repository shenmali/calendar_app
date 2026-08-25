import React from 'react';

import { eventDateInIstanbul, eventsForDay } from '@/lib/calendar/event-selectors';
import type { DayModel, MonthModel } from '@/lib/calendar/year-grid';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type MonthDayStripProps = {
  month: MonthModel;
  eventsByDay: Map<string, CalendarDisplayEvent[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  headingId: string;
  instructionId: string;
};

function isDatedDay(day: DayModel): day is DayModel & { date: string } {
  return day.date !== null;
}

function dayLabel(date: string, month: MonthModel): string {
  return `${Number(date.slice(-2))} ${month.label}`;
}

function isWeekend(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 || weekday === 6;
}

export function MonthDayStrip({ month, eventsByDay, selectedDate, onSelectDate, headingId, instructionId }: MonthDayStripProps) {
  const days = month.weeks.flat().filter(isDatedDay);
  const today = eventDateInIstanbul({ startsAt: new Date().toISOString(), isAllDay: false });

  return (
    <div
      aria-describedby={instructionId}
      aria-labelledby={headingId}
      className="month-day-strip overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      data-testid="month-day-strip"
      role="group"
      tabIndex={0}
    >
      <div className="flex min-w-max border-y border-slate-200 bg-white">
        {days.map((day) => {
          const events = eventsByDay.get(day.date) ?? [];
          const { visible, remaining } = eventsForDay(events);
          const weekend = isWeekend(day.date);
          const selected = day.date === selectedDate;
          const isToday = day.date === today;

          return (
            <button
              aria-label={`${dayLabel(day.date, month)} gününü seç`}
              aria-pressed={selected}
              className={`month-day-strip__day relative flex min-h-32 w-[5.75rem] shrink-0 flex-col border-r border-slate-200 px-2 py-2 text-left transition hover:bg-sky-50 sm:min-h-36 sm:w-28 ${weekend ? 'month-day-strip__day--weekend' : ''} ${selected ? 'month-day-strip__day--selected' : ''}`}
              key={day.date}
              data-date={day.date}
              onClick={() => onSelectDate(day.date)}
              type="button"
            >
              <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${weekend ? 'text-rose-500' : 'text-slate-400'}`}>{day.weekday}</span>
              <time className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-lg font-semibold tabular-nums ${isToday ? 'bg-sky-700 text-white' : 'text-slate-800'}`} dateTime={day.date}>{Number(day.date.slice(-2))}</time>
              <span className="mt-3 space-y-1">
                {visible.map((event) => (
                  <span className="block truncate rounded-sm px-1.5 py-1 text-[10px] font-medium leading-3 text-slate-700" key={event.id} style={{ backgroundColor: `${event.sourceColor ?? '#0284c7'}20`, borderLeft: `2px solid ${event.sourceColor ?? '#0284c7'}` }}>
                    {event.title}
                  </span>
                ))}
                {remaining > 0 ? <span className="block px-1 text-[10px] font-semibold text-sky-700">+{remaining} etkinlik</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
