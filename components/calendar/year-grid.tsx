'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { CalendarToolbar } from '@/components/calendar/calendar-toolbar';
import { EventDetailPanel } from '@/components/calendar/event-detail-panel';
import { MonthCard } from '@/components/calendar/month-card';
import type { CalendarSourceFilter } from '@/components/calendar/source-filter';
import { eventDateInIstanbul, groupEventsByDay, selectEvents } from '@/lib/calendar/event-selectors';
import { readManualSyncResult } from '@/lib/calendar/sync-refresh';
import { reconcileSourceSelection } from '@/lib/calendar/source-selection';
import { buildYearMonths } from '@/lib/calendar/year-grid';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type YearGridProps = {
  events: CalendarDisplayEvent[];
  initialYear?: number;
  lastSyncedAt: string | null;
};

function getTodayInIstanbul(): string {
  return eventDateInIstanbul({ startsAt: new Date().toISOString(), isAllDay: false });
}

function sourceFilters(events: CalendarDisplayEvent[]): CalendarSourceFilter[] {
  const sources = new Map<string, CalendarSourceFilter>();
  for (const event of events) {
    if (!sources.has(event.sourceId)) {
      sources.set(event.sourceId, {
        id: event.sourceId,
        name: event.sourceName ?? event.sourceCalendarId,
        color: event.sourceColor ?? (event.provider === 'google' ? '#0284c7' : '#7c3aed'),
      });
    }
  }
  return [...sources.values()];
}

export function YearGrid({ events, initialYear = 2026, lastSyncedAt }: YearGridProps) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState(`${initialYear}-01-15`);
  const sources = useMemo(() => sourceFilters(events), [events]);
  const sourceIds = useMemo(() => sources.map((source) => source.id), [sources]);
  const previousSourceIds = useRef(sourceIds);
  const [selectedSourceIds, setSelectedSourceIds] = useState(() => sources.map((source) => source.id));
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'partial' | 'error'>('idle');
  const months = useMemo(() => buildYearMonths(year, 1), [year]);
  const filteredEvents = useMemo(() => selectEvents(events, { year, sourceIds: selectedSourceIds }), [events, selectedSourceIds, year]);
  const eventsByDay = useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents]);
  const selectedEvents = eventsByDay.get(selectedDate) ?? [];

  useEffect(() => {
    const nextSelection = reconcileSourceSelection({
      previousSourceIds: previousSourceIds.current,
      selectedSourceIds,
      nextSourceIds: sourceIds,
    });
    previousSourceIds.current = sourceIds;
    if (nextSelection.length !== selectedSourceIds.length || nextSelection.some((sourceId, index) => sourceId !== selectedSourceIds[index])) {
      setSelectedSourceIds(nextSelection);
    }
  }, [selectedSourceIds, sourceIds]);

  function updateYear(nextYear: number) {
    setYear(nextYear);
    setSelectedDate(`${nextYear}-01-15`);
  }

  function selectToday() {
    const today = getTodayInIstanbul();
    setYear(Number(today.slice(0, 4)));
    setSelectedDate(today);
  }

  async function refreshCalendar() {
    setSyncState('syncing');
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      const result = await readManualSyncResult(response);
      setSyncState(result.state);
      if (result.shouldRefresh) router.refresh();
    } catch {
      setSyncState('error');
    }
  }

  return (
    <main aria-label={`${year} yıllık takvim`} className="mx-auto max-w-[1600px] p-4 lg:p-6">
      <header className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">Kişisel planlayıcı</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{year} Yıllık Takvim</h1>
      </header>
      <CalendarToolbar
        onNextYear={() => updateYear(year + 1)}
        onPreviousYear={() => updateYear(year - 1)}
        onRefresh={refreshCalendar}
        onSourceChange={setSelectedSourceIds}
        onToday={selectToday}
        selectedSourceIds={selectedSourceIds}
        lastSyncedAt={lastSyncedAt}
        sources={sources}
        syncState={syncState}
        year={year}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-label="Yıl ayları" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="year-grid">
          {months.map((month) => <MonthCard eventsByDay={eventsByDay} key={month.month} month={month} onSelectDate={setSelectedDate} selectedDate={selectedDate} />)}
        </section>
        <EventDetailPanel date={selectedDate} events={selectedEvents} />
      </div>
      {events.length === 0 ? <p className="mt-4 text-sm text-slate-500">Bağlı takvimlerde gösterilecek etkinlik yok.</p> : null}
    </main>
  );
}
