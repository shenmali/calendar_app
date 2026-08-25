import type { Ref } from 'react';

import { TURKISH_MONTHS } from '@/lib/calendar/year-grid';
import { formatEventTimeRange } from '@/lib/calendar/event-display';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type EventDetailPanelProps = {
  date: string;
  events: CalendarDisplayEvent[];
  panelRef?: Ref<HTMLElement>;
  className?: string;
};

function dateHeading(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${TURKISH_MONTHS[month - 1]} ${year}`;
}

export function EventDetailPanel({ date, events, panelRef, className }: EventDetailPanelProps) {
  return (
    <aside aria-label="Seçili gün ayrıntıları" aria-live="polite" className={`h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] xl:sticky xl:top-6 ${className ?? ''}`} ref={panelRef} tabIndex={-1}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Seçili gün</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-800">{dateHeading(date)}</h2>
      {events.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-slate-500">Bu gün için etkinlik yok.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {events.map((event) => (
            <li className="border-l-2 border-sky-600 pl-3" key={event.id}>
              <p className="text-sm font-semibold text-slate-800">{event.title}</p>
              <p className="text-xs text-slate-500">{formatEventTimeRange(event)}</p>
              {event.location ? <p className="mt-1 text-xs text-slate-600">{event.location}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{event.sourceName ?? (event.provider === 'google' ? 'Google Takvim' : 'Outlook Takvim')}</p>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
