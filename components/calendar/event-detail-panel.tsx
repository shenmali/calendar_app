import type { Ref } from 'react';

import { TURKISH_MONTHS } from '@/lib/calendar/year-grid';
import { formatEventTimeRange } from '@/lib/calendar/event-display';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type EventDetailPanelProps = {
  date: string;
  events: CalendarDisplayEvent[];
  panelRef?: Ref<HTMLElement>;
};

function dateHeading(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${TURKISH_MONTHS[month - 1]} ${year}`;
}

export function EventDetailPanel({ date, events, panelRef }: EventDetailPanelProps) {
  return (
    <aside aria-label="Seçili gün ayrıntıları" aria-live="polite" className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4" ref={panelRef} tabIndex={-1}>
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Seçili gün</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{dateHeading(date)}</h2>
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
