'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { CalendarToolbar } from '@/components/calendar/calendar-toolbar';
import { ConnectionsDialog } from '@/components/calendar/connections-dialog';
import { DayView } from '@/components/calendar/day-view';
import { EventDetailPanel } from '@/components/calendar/event-detail-panel';
import { HorizontalYearRail } from '@/components/calendar/horizontal-year-rail';
import { MonthView } from '@/components/calendar/month-view';
import type { CalendarSourceFilter } from '@/components/calendar/source-filter';
import type { CalendarView } from '@/components/calendar/view-switcher';
import { WeekView } from '@/components/calendar/week-view';
import { eventDateInIstanbul, groupEventsByDay, selectEvents } from '@/lib/calendar/event-selectors';
import { activeExportRange } from '@/lib/calendar/export-range';
import { revealSelectedDayDetail } from '@/lib/calendar/detail-focus';
import { selectCalendarDay } from '@/lib/calendar/day-selection';
import { readManualSyncResult } from '@/lib/calendar/sync-refresh';
import { initialSelectedSourceIds, reconcileSourceSelection, removeConnectionSourceIds } from '@/lib/calendar/source-selection';
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
        isSelected: event.sourceIsSelected,
      });
    }
  }
  return [...sources.values()];
}

function viewFromSearchParam(value: string | null): CalendarView {
  return value === 'month' || value === 'week' || value === 'day' ? value : 'year';
}

export function YearGrid({ events, initialYear = 2026, lastSyncedAt }: YearGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [year, setYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState(`${initialYear}-01-15`);
  const detailPanelRef = useRef<HTMLElement | null>(null);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const sources = useMemo(() => sourceFilters(events), [events]);
  const sourceIds = useMemo(() => sources.map((source) => source.id), [sources]);
  const previousSourceIds = useRef(sourceIds);
  const [selectedSourceIds, setSelectedSourceIds] = useState(() => initialSelectedSourceIds(sources));
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'partial' | 'error'>('idle');
  const [revealNonce, setRevealNonce] = useState(0);
  const months = useMemo(() => buildYearMonths(year, 1), [year]);
  const filteredEvents = useMemo(() => selectEvents(events, { sourceIds: selectedSourceIds }), [events, selectedSourceIds]);
  const eventsByDay = useMemo(() => groupEventsByDay(filteredEvents), [filteredEvents]);
  const selectedEvents = eventsByDay.get(selectedDate) ?? [];
  const view = viewFromSearchParam(searchParams.get('view'));
  const activeMonth = months[Number(selectedDate.slice(5, 7)) - 1];

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
    setRevealNonce((current) => current + 1);
  }

  function updateView(nextView: CalendarView) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextView === 'year') params.delete('view');
    else params.set('view', nextView);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
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

  function updateConnectionSourceSelection(sourceId: string, isSelected: boolean) {
    setSelectedSourceIds((current) => isSelected ? [...new Set([...current, sourceId])] : current.filter((id) => id !== sourceId));
    router.refresh();
  }

  function removeConnectionFromView(connectionId: string) {
    setSelectedSourceIds((current) => removeConnectionSourceIds(current, events, connectionId));
    router.refresh();
  }

  function selectDate(date: string) {
    selectCalendarDay(date, {
      select: setSelectedDate,
      // Wait for React to move the mobile inspector under the newly selected month.
      shouldReveal: () => window.matchMedia('(max-width: 767px)').matches && detailPanelRef.current !== null,
      reveal: () => {
        window.requestAnimationFrame(() => {
          if (detailPanelRef.current) {
            revealSelectedDayDetail(detailPanelRef.current, window.matchMedia('(prefers-reduced-motion: reduce)').matches);
          }
        });
      },
    });
  }

  return (
    <main aria-label={`${year} yıllık takvim`} className="mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8">
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">Kişisel planlayıcı</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-800">{year} Yıllık Takvim</h1>
      </header>
      <CalendarToolbar
        exportRange={activeExportRange(view, selectedDate, year)}
        lastSyncedAt={lastSyncedAt}
        onConnections={() => setConnectionsOpen(true)}
        onNextYear={() => updateYear(year + 1)}
        onPreviousYear={() => updateYear(year - 1)}
        onRefresh={refreshCalendar}
        onSourceChange={setSelectedSourceIds}
        onToday={selectToday}
        onViewChange={updateView}
        selectedSourceIds={selectedSourceIds}
        sources={sources}
        syncState={syncState}
        view={view}
        year={year}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-8">
        {view === 'year' ? (
          <div className="calendar-year-rail order-1 min-w-0">
            <HorizontalYearRail
              eventsByDay={eventsByDay}
              months={months}
              onSelectDate={selectDate}
              revealNonce={revealNonce}
              selectedDate={selectedDate}
              selectedDayDetail={<EventDetailPanel className="mt-4 xl:hidden" date={selectedDate} events={selectedEvents} panelRef={detailPanelRef} />}
            />
          </div>
        ) : null}
        {view === 'month' ? <div className="order-2"><MonthView eventsByDay={eventsByDay} month={activeMonth} onSelectDate={selectDate} selectedDate={selectedDate} /></div> : null}
        {view === 'week' ? <div className="order-2"><WeekView events={filteredEvents} onSelectDate={selectDate} selectedDate={selectedDate} /></div> : null}
        {view === 'day' ? <div className="order-2"><DayView date={selectedDate} events={selectedEvents} /></div> : null}
        {view !== 'day' ? <div className={view === 'year' ? 'order-2 hidden xl:block' : 'order-1 xl:order-2'}><EventDetailPanel date={selectedDate} events={selectedEvents} panelRef={view === 'year' ? undefined : detailPanelRef} /></div> : null}
      </div>
      {filteredEvents.length === 0 ? <p className="mt-4 text-sm text-slate-500">Bağlı takvimlerde gösterilecek etkinlik yok.</p> : null}
      <ConnectionsDialog onClose={() => setConnectionsOpen(false)} onConnectionDeleted={removeConnectionFromView} onSourceSelectionChange={updateConnectionSourceSelection} open={connectionsOpen} />
    </main>
  );
}
