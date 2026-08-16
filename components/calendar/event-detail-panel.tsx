import { TURKISH_MONTHS } from '@/lib/calendar/year-grid';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

type EventDetailPanelProps = {
  date: string;
  events: CalendarDisplayEvent[];
};

function dateHeading(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${TURKISH_MONTHS[month - 1]} ${year}`;
}

function eventTime(event: CalendarDisplayEvent): string {
  if (event.isAllDay) return 'Tüm gün';
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' }).format(new Date(event.startsAt));
}

export function EventDetailPanel({ date, events }: EventDetailPanelProps) {
  return (
    <aside aria-label="Seçili gün ayrıntıları" className="h-fit rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Seçili gün</p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{dateHeading(date)}</h2>
      {events.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-slate-500">Bu gün için etkinlik yok.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {events.map((event) => (
            <li className="border-l-2 border-sky-600 pl-3" key={event.id}>
              <p className="text-sm font-semibold text-slate-800">{event.title}</p>
              <p className="text-xs text-slate-500">{eventTime(event)}</p>
              {event.location ? <p className="mt-1 text-xs text-slate-600">{event.location}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{event.sourceName ?? (event.provider === 'google' ? 'Google Takvim' : 'Outlook Takvim')}</p>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
