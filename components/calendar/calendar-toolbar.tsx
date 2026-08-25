'use client';

import { SourceFilter, type CalendarSourceFilter } from '@/components/calendar/source-filter';
import { ViewSwitcher, type CalendarView } from '@/components/calendar/view-switcher';
import { ExportMenu } from '@/components/calendar/export-menu';
import { formatSyncStatus } from '@/lib/calendar/event-display';
import type { DateRange } from '@/lib/calendar/types';

type CalendarToolbarProps = {
  year: number;
  sources: CalendarSourceFilter[];
  selectedSourceIds: string[];
  syncState: 'idle' | 'syncing' | 'success' | 'partial' | 'error';
  lastSyncedAt: string | null;
  onPreviousYear: () => void;
  onNextYear: () => void;
  onToday: () => void;
  onSourceChange: (sourceIds: string[]) => void;
  onRefresh: () => void;
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
  onConnections: () => void;
  exportRange: DateRange;
};

export function CalendarToolbar({
  year, sources, selectedSourceIds, syncState, lastSyncedAt, onPreviousYear, onNextYear, onToday, onSourceChange, onRefresh, view, onViewChange, onConnections, exportRange,
}: CalendarToolbarProps) {
  return (
    <nav aria-label="Takvim araçları" className="mb-5 border-b border-slate-100 pb-3">
      <div className="flex flex-col gap-3">
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="flex items-center gap-1" aria-label="Yıl seçici">
            <button className="calendar-control" onClick={onPreviousYear} type="button" aria-label="Önceki yıl">‹</button>
            <span aria-live="polite" className="min-w-16 text-center text-sm font-semibold tabular-nums">{year}</span>
            <button className="calendar-control" onClick={onNextYear} type="button" aria-label="Sonraki yıl">›</button>
          </div>
          <button className="calendar-control" onClick={onToday} type="button">Bugün</button>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
          <ViewSwitcher onChange={onViewChange} view={view} />
          <button className="calendar-control" onClick={onConnections} type="button">Bağlantılar</button>
          <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
          <div className="w-full min-w-0 sm:w-auto">
            <SourceFilter sources={sources} selectedSourceIds={selectedSourceIds} onChange={onSourceChange} />
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto lg:ml-auto lg:flex-nowrap">
            <span aria-live="polite" className="hidden text-xs text-slate-500 lg:inline">{formatSyncStatus(syncState, lastSyncedAt)}</span>
            <button className="calendar-control bg-sky-700 text-white hover:bg-sky-800 disabled:bg-sky-400" disabled={syncState === 'syncing'} onClick={onRefresh} type="button">
              {syncState === 'syncing' ? 'Yenileniyor…' : 'Yenile'}
            </button>
            <ExportMenu range={exportRange} sourceIds={selectedSourceIds} />
          </div>
        </div>
      </div>
    </nav>
  );
}
