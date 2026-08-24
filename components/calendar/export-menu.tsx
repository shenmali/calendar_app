import React from 'react';

import type { DateRange } from '@/lib/calendar/types';

type ExportMenuProps = {
  range: DateRange;
  sourceIds: string[];
};

function exportHref(format: 'ics' | 'csv' | 'xlsx', range: DateRange, sourceIds: string[]): string {
  const params = new URLSearchParams({ start: range.start, end: range.end, sourceSelection: 'selected' });
  for (const sourceId of sourceIds) params.append('sourceId', sourceId);
  return `/api/export/${format}?${params.toString()}`;
}

/** Browser-native downloads keep export behavior simple and accessible. */
export function ExportMenu({ range, sourceIds }: ExportMenuProps) {
  return (
    <details className="relative">
      <summary className="calendar-control cursor-pointer list-none">Dışa Aktar</summary>
      <div className="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        <a className="block rounded px-3 py-2 text-sm hover:bg-slate-100" download href={exportHref('ics', range, sourceIds)}>ICS takvim</a>
        <a className="block rounded px-3 py-2 text-sm hover:bg-slate-100" download href={exportHref('csv', range, sourceIds)}>CSV dosyası</a>
        <a className="block rounded px-3 py-2 text-sm hover:bg-slate-100" download href={exportHref('xlsx', range, sourceIds)}>Excel dosyası</a>
      </div>
    </details>
  );
}
