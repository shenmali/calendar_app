'use client';

import React, { useEffect, useId, useRef } from 'react';

import { MonthDayStrip } from '@/components/calendar/month-day-strip';
import { shouldRevealSelectedMonth } from '@/lib/calendar/day-selection';
import { revealDateInStrip } from '@/lib/calendar/day-strip-reveal';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';
import type { MonthModel } from '@/lib/calendar/year-grid';

type HorizontalYearRailProps = {
  months: MonthModel[];
  eventsByDay: Map<string, CalendarDisplayEvent[]>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  selectedDayDetail?: React.ReactNode;
  revealNonce?: number;
};

export function HorizontalYearRail({ months, eventsByDay, selectedDate, onSelectDate, selectedDayDetail, revealNonce = 0 }: HorizontalYearRailProps) {
  const instructionId = useId();
  const railRef = useRef<HTMLDivElement | null>(null);
  const previousSelectedYearRef = useRef<string | null>(null);
  const previousRevealNonceRef = useRef(revealNonce);
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
    const forceReveal = previousRevealNonceRef.current !== revealNonce;
    previousRevealNonceRef.current = revealNonce;
    const selectedCard = railRef.current?.querySelector<HTMLElement>(`[data-month="${selectedMonthKey}"]`);
    if (!selectedCard) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (shouldReveal || forceReveal) {
      selectedCard.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      const selectedStrip = selectedCard.querySelector<HTMLElement>('[data-testid="month-day-strip"]');
      if (selectedStrip) revealDateInStrip(selectedStrip, selectedDate, prefersReducedMotion);
    }
  }, [revealNonce, selectedDate, selectedMonthKey, selectedYear]);

  return (
    <section aria-label="Yıllık takvim ayları" className="min-w-0">
      <p className="mb-4 text-xs text-slate-500" id={instructionId}>Her ayın günleri yatay olarak kaydırılabilir</p>
      <div
        aria-describedby={instructionId}
        aria-label="Yıllık gün şeritleri"
        className="space-y-4"
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
              className="relative scroll-mt-4 rounded-2xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
              data-month={monthKey}
              data-selected-month={month.month === selectedMonth ? month.month : undefined}
              id={`year-${selectedYear}-month-${monthNumber}`}
              key={monthKey}
            >
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-700" id={headingId}>{month.label}</h2>
                <span className="text-xs text-slate-400">{month.weeks.flat().filter((day) => day.date !== null).length} gün</span>
              </div>
              <MonthDayStrip eventsByDay={eventsByDay} headingId={headingId} instructionId={instructionId} month={month} onSelectDate={onSelectDate} selectedDate={selectedDate} />
              {month.month === selectedMonth ? selectedDayDetail : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}
