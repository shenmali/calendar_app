import { exportColumns, formatExportDate, sourceLabel, type ExportCalendarEvent } from '@/lib/export/types';

function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Exports a BOM-prefixed, spreadsheet-safe RFC 4180 CSV. */
export function createCsv(events: ExportCalendarEvent[]): string {
  const rows = [exportColumns.join(',')];
  for (const event of events) {
    const values = [
      event.title, formatExportDate(event, event.startsAt), formatExportDate(event, event.endsAt), event.isAllDay ? 'Evet' : 'Hayır',
      event.location ?? '', sourceLabel(event), event.sourceName ?? event.sourceCalendarId, event.description ?? '',
    ];
    rows.push(values.map((value) => quote(safeText(value))).join(','));
  }
  return `\uFEFF${rows.join('\r\n')}\r\n`;
}
