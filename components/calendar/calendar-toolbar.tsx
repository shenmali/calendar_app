'use client';

import { SourceFilter, type CalendarSourceFilter } from '@/components/calendar/source-filter';
import { formatSyncStatus } from '@/lib/calendar/event-display';

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
};

export function CalendarToolbar({
  year, sources, selectedSourceIds, syncState, lastSyncedAt, onPreviousYear, onNextYear, onToday, onSourceChange, onRefresh,
}: CalendarToolbarProps) {
  return (
    <nav aria-label="Takvim araçları" className="mb-5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" aria-label="Yıl seçici">
          <button className="calendar-control" onClick={onPreviousYear} type="button" aria-label="Önceki yıl">‹</button>
          <span aria-live="polite" className="min-w-16 text-center text-sm font-semibold tabular-nums">{year}</span>
          <button className="calendar-control" onClick={onNextYear} type="button" aria-label="Sonraki yıl">›</button>
        </div>
        <button className="calendar-control" onClick={onToday} type="button">Bugün</button>
        <span className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
        <SourceFilter sources={sources} selectedSourceIds={selectedSourceIds} onChange={onSourceChange} />
        <div className="ml-auto flex items-center gap-2">
          <span aria-live="polite" className="hidden text-xs text-slate-500 lg:inline">{formatSyncStatus(syncState, lastSyncedAt)}</span>
          <button className="calendar-control bg-sky-700 text-white hover:bg-sky-800 disabled:bg-sky-400" disabled={syncState === 'syncing'} onClick={onRefresh} type="button">
            {syncState === 'syncing' ? 'Yenileniyor…' : 'Yenile'}
          </button>
          <button aria-disabled="true" className="calendar-control cursor-not-allowed text-slate-400" title="Dışa aktarma yakında kullanılabilir" type="button">
            Dışa Aktar
          </button>
        </div>
      </div>
    </nav>
  );
}
