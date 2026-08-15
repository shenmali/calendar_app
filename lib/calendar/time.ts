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
  const withZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
    ? value
    : timeZone === 'UTC' ? `${value}Z` : value;
  const instant = new Date(withZone);
  if (Number.isNaN(instant.getTime())) throw new Error('Expected an ISO instant');
  return instant.toISOString();
}

export function rangeToIsoInstants(range: DateRange): DateRange {
  return { start: isoInstant(range.start), end: isoInstant(range.end) };
}
