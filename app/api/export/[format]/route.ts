import { NextResponse } from 'next/server';
import { z } from 'zod';

import { allDayDateInIstanbul } from '@/lib/calendar/event-selectors';
import { isoInstant } from '@/lib/calendar/time';
import { createCsv } from '@/lib/export/csv';
import { createIcs } from '@/lib/export/ics';
import type { ExportCalendarEvent } from '@/lib/export/types';
import { createXlsx } from '@/lib/export/xlsx';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const formats = ['ics', 'csv', 'xlsx'] as const;
type ExportFormat = (typeof formats)[number];
const pageSize = 500;
const filterChunkSize = 100;

function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day);
}

const filtersSchema = z.object({
  start: z.string().refine(isRealDate),
  end: z.string().refine(isRealDate),
  connectionId: z.array(z.string().uuid()).default([]),
  sourceId: z.array(z.string().uuid()).default([]),
  sourceSelection: z.literal('selected').optional(),
}).superRefine((value, context) => {
  if (value.end <= value.start) context.addIssue({ code: 'custom', path: ['end'], message: 'End must follow start' });
  const span = Date.parse(`${value.end}T00:00:00Z`) - Date.parse(`${value.start}T00:00:00Z`);
  if (span > 366 * 24 * 60 * 60 * 1000) context.addIssue({ code: 'custom', path: ['end'], message: 'Range may not exceed one year' });
});

type SourceRow = { id: string; connection_id: string; remote_calendar_id: string; name: string };
type ConnectionRow = { id: string; provider: 'google' | 'microsoft' };
type EventRow = {
  id: string; remote_event_id: string; connection_id: string; source_id: string; title: string; description: string | null; location: string | null;
  starts_at: string; ends_at: string; updated_at: string | null; is_all_day: boolean; status: 'confirmed' | 'cancelled';
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function chunks<T>(values: T[]): T[][] {
  if (!values.length) return [[]];
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += filterChunkSize) result.push(values.slice(index, index + filterChunkSize));
  return result;
}

function overlapsExportRange(event: EventRow, filters: { start: string; end: string }, range: { start: string; end: string }): boolean {
  if (event.is_all_day) {
    const start = allDayDateInIstanbul(event.starts_at);
    const end = allDayDateInIstanbul(event.ends_at);
    return start < filters.end && end > filters.start;
  }
  return event.starts_at < range.end && event.ends_at > range.start;
}

function isFormat(value: string): value is ExportFormat {
  return (formats as readonly string[]).includes(value);
}

function responseFor(format: ExportFormat, events: ExportCalendarEvent[]): NextResponse {
  const filename = `calendar-export.${format}`;
  const headers = {
    'cache-control': 'private, no-store',
    'content-disposition': `attachment; filename="${filename}"`,
  };
  if (format === 'ics') return new NextResponse(createIcs(events), { headers: { ...headers, 'content-type': 'text/calendar; charset=utf-8' } });
  if (format === 'csv') return new NextResponse(createCsv(events), { headers: { ...headers, 'content-type': 'text/csv; charset=utf-8' } });
  const xlsx = createXlsx(events);
  return new NextResponse(xlsx.buffer as ArrayBuffer, { headers: { ...headers, 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
}

export async function GET(request: Request, { params }: { params: Promise<{ format: string }> }) {
  const { format } = await params;
  if (!isFormat(format)) return new NextResponse(null, { status: 404 });

  const searchParams = new URL(request.url).searchParams;
  const parsed = filtersSchema.safeParse({
    start: searchParams.get('start'), end: searchParams.get('end'),
    connectionId: searchParams.getAll('connectionId'), sourceId: searchParams.getAll('sourceId'), sourceSelection: searchParams.get('sourceSelection') ?? undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid export filters' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const filters = { ...parsed.data, connectionId: unique(parsed.data.connectionId), sourceId: unique(parsed.data.sourceId) };
  if (filters.sourceSelection === 'selected' && !filters.sourceId.length) return responseFor(format, []);
  const admin = createAdminClient();
  const sources: SourceRow[] = [];
  for (const sourceIds of chunks(filters.sourceId)) {
    for (const connectionIds of chunks(filters.connectionId)) {
      let sourceQuery = admin.from('calendar_sources').select('id, connection_id, remote_calendar_id, name').eq('user_id', user.id);
      if (sourceIds.length) sourceQuery = sourceQuery.in('id', sourceIds);
      if (connectionIds.length) sourceQuery = sourceQuery.in('connection_id', connectionIds);
      sourceQuery = sourceQuery.order('id', { ascending: true });
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await sourceQuery.range(offset, offset + pageSize - 1);
        if (error) return NextResponse.json({ error: 'Unable to load export sources' }, { status: 500 });
        const page = data as SourceRow[];
        sources.push(...page);
        if (page.length < pageSize) break;
      }
    }
  }
  const uniqueSources = [...new Map(sources.map((source) => [source.id, source])).values()].sort((left, right) => left.id.localeCompare(right.id));
  if (!uniqueSources.length) return responseFor(format, []);

  const connectionIds = unique(uniqueSources.map((source) => source.connection_id));
  const connections: ConnectionRow[] = [];
  for (const connectionIdChunk of chunks(connectionIds)) {
    const connectionQuery = admin.from('oauth_connections').select('id, provider').eq('user_id', user.id).in('id', connectionIdChunk).order('id', { ascending: true });
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await connectionQuery.range(offset, offset + pageSize - 1);
      if (error) return NextResponse.json({ error: 'Unable to load export connections' }, { status: 500 });
      const page = data as ConnectionRow[];
      connections.push(...page);
      if (page.length < pageSize) break;
    }
  }
  const providers = new Map(connections.flatMap((connection) => (
    connection.provider === 'google' || connection.provider === 'microsoft' ? [[connection.id, connection.provider] as const] : []
  )));
  const sourceById = new Map(uniqueSources.filter((source) => providers.has(source.connection_id)).map((source) => [source.id, source]));
  if (!sourceById.size) return responseFor(format, []);

  const range = {
    start: isoInstant(`${filters.start}T00:00:00`, 'Europe/Istanbul'),
    end: isoInstant(`${filters.end}T00:00:00`, 'Europe/Istanbul'),
  };
  const eventRows: EventRow[] = [];
  for (const sourceIdChunk of chunks([...sourceById.keys()])) {
    const eventQuery = admin.from('calendar_events')
      .select('id, remote_event_id, connection_id, source_id, title, description, location, starts_at, ends_at, updated_at, is_all_day, status')
      .eq('user_id', user.id).eq('status', 'confirmed').in('source_id', sourceIdChunk)
      .lt('starts_at', range.end).gt('ends_at', range.start).order('starts_at', { ascending: true }).order('id', { ascending: true });
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await eventQuery.range(offset, offset + pageSize - 1);
      if (error) return NextResponse.json({ error: 'Unable to load export events' }, { status: 500 });
      const page = data as EventRow[];
      eventRows.push(...page);
      if (page.length < pageSize) break;
    }
  }

  const events: ExportCalendarEvent[] = eventRows.filter((event) => overlapsExportRange(event, filters, range)).sort((left, right) => (
    left.starts_at.localeCompare(right.starts_at) || left.id.localeCompare(right.id)
  )).flatMap((event) => {
    const source = sourceById.get(event.source_id);
    const provider = providers.get(event.connection_id);
    if (!source || !provider || source.connection_id !== event.connection_id) return [];
    return [{
      id: event.id, remoteEventId: event.remote_event_id, connectionId: event.connection_id, sourceId: event.source_id, sourceCalendarId: source.remote_calendar_id,
      provider, title: event.title, description: event.description, location: event.location,
      startsAt: event.is_all_day ? allDayDateInIstanbul(event.starts_at) : event.starts_at,
      endsAt: event.is_all_day ? allDayDateInIstanbul(event.ends_at) : event.ends_at,
      updatedAt: event.updated_at ?? undefined, isAllDay: event.is_all_day, status: event.status, sourceName: source.name, sourceIsSelected: true,
    }];
  });
  return responseFor(format, events);
}
