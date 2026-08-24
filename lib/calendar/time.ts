import type { DateRange } from '@/lib/calendar/types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(value: string): string {
  if (!ISO_DATE.test(value)) throw new Error('Expected an ISO calendar date');
  return value;
}

/**
 * Provider adapters request UTC from Graph and receive offset timestamps from
 * Google. This keeps a timed value an instant, rather than formatting it for
 * the Europe/Istanbul presentation layer.
 */
export function isoInstant(value: string, timeZone?: string | null): string {
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    const instant = new Date(value);
    if (Number.isNaN(instant.getTime())) throw new Error('Expected an ISO instant');
    return instant.toISOString();
  }
  if (!timeZone) throw new Error('An IANA timezone is required for an offset-less instant');
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);
  if (!match) throw new Error('Expected an ISO instant');
  const [, year, month, day, hour, minute, second, fraction = ''] = match;
  const milliseconds = Number(fraction.padEnd(3, '0'));
  const civilAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second), milliseconds);
  const offsetAt = (epoch: number): number => {
    const zoneName = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(new Date(epoch)).find((part) => part.type === 'timeZoneName')?.value;
    const offset = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/.exec(zoneName ?? '');
    if (!offset) throw new Error('Expected a valid IANA timezone');
    if (!offset[1]) return 0;
    const minutes = Number(offset[2]) * 60 + Number(offset[3]);
    return (offset[1] === '-' ? -1 : 1) * minutes * 60_000;
  };
  // Re-evaluate once at the resulting instant so DST offsets come from the requested IANA zone, not the host locale.
  let epoch = civilAsUtc - offsetAt(civilAsUtc);
  epoch = civilAsUtc - offsetAt(epoch);
  return new Date(epoch).toISOString();
}

export function rangeToIsoInstants(range: DateRange): DateRange {
  return { start: isoInstant(range.start), end: isoInstant(range.end) };
}

function calendarDateAt(instantValue: string, timeZone: string): string {
  const instant = new Date(instantValue);
  if (Number.isNaN(instant.getTime())) throw new Error('Expected an ISO instant');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) throw new Error('Expected a valid IANA timezone');
  return `${year}-${month}-${day}`;
}

/** Compares all-day values as source-calendar dates, using half-open ranges. */
export function allDayOverlapsRange(
  event: { startsAt: string; endsAt: string },
  range: DateRange,
  timeZone = 'Europe/Istanbul',
): boolean {
  const startsOn = calendarDateAt(event.startsAt, timeZone);
  const endsOn = calendarDateAt(event.endsAt, timeZone);
  const rangeStartsOn = calendarDateAt(range.start, timeZone);
  const rangeEndsOn = calendarDateAt(range.end, timeZone);
  return startsOn < rangeEndsOn && endsOn > rangeStartsOn;
}
