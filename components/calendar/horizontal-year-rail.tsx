'use client';

import React, { useEffect, useId, useRef } from 'react';

import { MonthDayStrip } from '@/components/calendar/month-day-strip';
import { shouldRevealSelectedMonth } from '@/lib/calendar/day-selection';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';
import type { MonthModel } from '@/lib/calendar/year-grid';

type HorizontalYearRailProps = {
  months: MonthModel[];
  eventsByDay: Map<string, CalendarDisplayEvent[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
};

export function HorizontalYearRail({ months, eventsByDay, selectedDate, onSelectDate }: HorizontalYearRailProps) {
  const instructionId = useId();
  const railRef = useRef<HTMLDivElement | null>(null);
  const previousSelectedYearRef = useRef<string | null>(null);
  const selectedYear = selectedDate.slice(0, 4);
  const selectedMonth = Number(selectedDate.slice(5, 7)) - 1;
  const selectedMonthKey = selectedDate.slice(0, 7);

  useEffect(() => {
    const isPhone = window.matchMedia('(max-width: 767px)').matches;
    // Phone date taps keep the user-positioned rail stable; a year change still resets it.
    const shouldReveal = shouldRevealSelectedMonth({
      isPhone,
      previousYear: previousSelectedYearRef.current,
      selectedYear,
    });
    previousSelectedYearRef.current = selectedYear;
    if (!shouldReveal) return;

    const selectedCard = railRef.current?.querySelector<HTMLElement>(`[data-month="${selectedMonthKey}"]`);
    if (!selectedCard) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    selectedCard.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [selectedMonthKey, selectedYear]);

  return (
    <section aria-label="Yıllık takvim ayları" className="min-w-0">
      <p className="mb-4 text-xs text-slate-500" id={instructionId}>Her ayın günleri yatay olarak kaydırılabilir</p>
      <div
        aria-describedby={instructionId}
        aria-label="Yıllık gün şeritleri"
        className="space-y-5"
        data-testid="year-rail"
        ref={railRef}
      >
        {months.map((month) => {
          const monthNumber = String(month.month + 1).padStart(2, '0');
          const monthKey = `${selectedYear}-${monthNumber}`;
          const headingId = `month-${selectedYear}-${monthNumber}`;
          return (
            <section
              aria-labelledby={headingId}
              className="relative scroll-mt-4"
              data-month={monthKey}
              data-selected-month={month.month === selectedMonth ? month.month : undefined}
              id={`year-${selectedYear}-month-${monthNumber}`}
              key={monthKey}
            >
              <div className="mb-2 flex items-end justify-between gap-4">
                <h2 className="text-base font-semibold tracking-tight text-slate-800" id={headingId}>{month.label}</h2>
                <span aria-hidden="true" className="select-none text-4xl font-semibold leading-none tracking-tighter text-slate-100 sm:text-6xl">{String(month.month + 1).padStart(2, '0')}</span>
              </div>
              <MonthDayStrip eventsByDay={eventsByDay} month={month} onSelectDate={onSelectDate} selectedDate={selectedDate} />
            </section>
          );
        })}
      </div>
    </section>
  );
}
