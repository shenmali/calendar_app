import { allDayDateInIstanbul } from '@/lib/calendar/event-selectors';
import type { ExportCalendarEvent } from '@/lib/export/types';

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

function foldLine(line: string): string[] {
  const lines: string[] = [];
  let pending = line;
  let prefix = '';
  while (pending) {
    const limit = 75 - Buffer.byteLength(prefix, 'utf8');
    let bytes = 0;
    let index = 0;
    for (const character of pending) {
      const size = Buffer.byteLength(character, 'utf8');
      if (bytes + size > limit) break;
      bytes += size;
      index += character.length;
    }
    if (index === 0) throw new Error('Unable to fold ICS content line');
    lines.push(prefix + pending.slice(0, index));
    pending = pending.slice(index);
    prefix = ' ';
  }
  return lines;
}

function utcDateTime(value: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error('Expected ISO calendar event instant');
  return instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function eventLines(event: ExportCalendarEvent): string[] {
  const remoteEventId = event.remoteEventId ?? event.id;
  const stamp = event.isAllDay ? `${allDayDateInIstanbul(event.startsAt).replace(/-/g, '')}T000000Z` : utcDateTime(event.startsAt);
  const lines = ['BEGIN:VEVENT', `UID:${escapeText(`${event.provider}:${event.connectionId}:${remoteEventId}`)}`, `DTSTAMP:${stamp}`];
  if (event.isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${allDayDateInIstanbul(event.startsAt).replace(/-/g, '')}`);
    lines.push(`DTEND;VALUE=DATE:${allDayDateInIstanbul(event.endsAt).replace(/-/g, '')}`);
  } else {
    lines.push(`DTSTART:${utcDateTime(event.startsAt)}`, `DTEND:${utcDateTime(event.endsAt)}`);
  }
  lines.push(`SUMMARY:${escapeText(event.title)}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.status === 'cancelled') lines.push('STATUS:CANCELLED');
  lines.push('END:VEVENT');
  return lines;
}

/** Creates a deterministic RFC 5545-compatible calendar without representing unrequested cancellations. */
export function createIcs(events: ExportCalendarEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Takvim//Calendar Export//TR', 'CALSCALE:GREGORIAN'];
  for (const event of events) lines.push(...eventLines(event));
  lines.push('END:VCALENDAR');
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}
