'use client';

import React, { useEffect, useId, useRef } from 'react';

import { MonthCard } from '@/components/calendar/month-card';
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
      <p className="mb-2 text-xs text-slate-500" id={instructionId}>Aylar yatay olarak kaydırılabilir</p>
      <div
        aria-describedby={instructionId}
        aria-label="Yıl ayları"
        className="-mx-4 snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:mx-0"
        data-testid="year-rail"
        ref={railRef}
        tabIndex={0}
      >
        <div className="flex w-max flex-nowrap gap-3 px-4 pb-2 sm:px-1">
          {months.map((month) => {
            const monthNumber = String(month.month + 1).padStart(2, '0');
            const monthKey = `${selectedYear}-${monthNumber}`;
            return (
              <MonthCard
                className="w-[86vw] max-w-[22rem] shrink-0 snap-start scroll-mx-4 sm:w-[22rem]"
                data-month={monthKey}
                data-selected-month={month.month === selectedMonth ? month.month : undefined}
                eventsByDay={eventsByDay}
                headingId={`month-${selectedYear}-${monthNumber}`}
                id={`year-${selectedYear}-month-${monthNumber}`}
                key={monthKey}
                month={month}
                onSelectDate={onSelectDate}
                selectedDate={selectedDate}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
