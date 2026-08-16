const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function formatParts(value: string, formatter: Intl.DateTimeFormat): Record<string, string> {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('Expected an ISO instant');
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function formatEventTimeRange(event: { startsAt: string; endsAt: string; isAllDay: boolean }): string {
  if (event.isAllDay) return 'Tüm gün';
  const starts = formatParts(event.startsAt, timeFormatter);
  const ends = formatParts(event.endsAt, timeFormatter);
  return `${starts.hour}:${starts.minute}–${ends.hour}:${ends.minute}`;
}

export function formatLastSyncedAt(value: string | null): string {
  if (!value) return 'Son eşitleme: Henüz eşitlenmedi';
  const parts = formatParts(value, dateTimeFormatter);
  return `Son eşitleme: ${parts.day}.${parts.month}.${parts.year} ${parts.hour}:${parts.minute}`;
}
