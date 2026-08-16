import type { CalendarDisplayEvent } from '@/lib/calendar/types';

/** A server-safe display event with the provider key retained solely for stable export IDs. */
export type ExportCalendarEvent = CalendarDisplayEvent & {
  remoteEventId?: string;
};

export const exportColumns = ['Başlık', 'Başlangıç', 'Bitiş', 'Tüm Gün', 'Konum', 'Kaynak', 'Takvim', 'Açıklama'] as const;

export function sourceLabel(event: ExportCalendarEvent): string {
  return event.provider === 'google' ? 'Google' : 'Microsoft';
}

export function formatExportDate(event: ExportCalendarEvent, value: string): string {
  if (event.isAllDay) return value.slice(0, 10);
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error('Expected ISO calendar event instant');
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(instant);
}

export function toExportRow(event: ExportCalendarEvent): (string | boolean | Date)[] {
  const date = (value: string): Date => {
    if (event.isAllDay) return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) throw new Error('Expected ISO calendar event instant');
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
    return new Date(Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second')));
  };
  return [event.title, date(event.startsAt), date(event.endsAt), event.isAllDay, event.location ?? '', sourceLabel(event), event.sourceName ?? event.sourceCalendarId, event.description ?? ''];
}
