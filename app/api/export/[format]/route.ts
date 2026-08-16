import { NextResponse } from 'next/server';
import { z } from 'zod';

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

const filtersSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  connectionId: z.array(z.string().uuid()).default([]),
  sourceId: z.array(z.string().uuid()).default([]),
}).superRefine((value, context) => {
  if (value.end <= value.start) context.addIssue({ code: 'custom', path: ['end'], message: 'End must follow start' });
  const span = Date.parse(`${value.end}T00:00:00Z`) - Date.parse(`${value.start}T00:00:00Z`);
  if (span > 366 * 24 * 60 * 60 * 1000) context.addIssue({ code: 'custom', path: ['end'], message: 'Range may not exceed one year' });
});

type SourceRow = { id: string; connection_id: string; remote_calendar_id: string; name: string };
type ConnectionRow = { id: string; provider: 'google' | 'microsoft' };
type EventRow = {
  id: string; remote_event_id: string; connection_id: string; source_id: string; title: string; description: string | null; location: string | null;
  starts_at: string; ends_at: string; is_all_day: boolean; status: 'confirmed' | 'cancelled';
};

function unique(values: string[]): string[] {
  return [...new Set(values)];
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

  const parsed = filtersSchema.safeParse({
    start: new URL(request.url).searchParams.get('start'), end: new URL(request.url).searchParams.get('end'),
    connectionId: new URL(request.url).searchParams.getAll('connectionId'), sourceId: new URL(request.url).searchParams.getAll('sourceId'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid export filters' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const filters = { ...parsed.data, connectionId: unique(parsed.data.connectionId), sourceId: unique(parsed.data.sourceId) };
  const admin = createAdminClient();
  let sourceQuery = admin.from('calendar_sources').select('id, connection_id, remote_calendar_id, name').eq('user_id', user.id);
  if (filters.sourceId.length) sourceQuery = sourceQuery.in('id', filters.sourceId);
  else sourceQuery = sourceQuery.eq('is_selected', true);
  if (filters.connectionId.length) sourceQuery = sourceQuery.in('connection_id', filters.connectionId);
  const sources: SourceRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sourceQuery.range(offset, offset + pageSize - 1);
    if (error) return NextResponse.json({ error: 'Unable to load export sources' }, { status: 500 });
    const page = data as SourceRow[];
    sources.push(...page);
    if (page.length < pageSize) break;
  }
  if (!sources.length) return responseFor(format, []);

  const connectionIds = unique(sources.map((source) => source.connection_id));
  const connectionQuery = admin.from('oauth_connections').select('id, provider').eq('user_id', user.id).in('id', connectionIds);
  const connections: ConnectionRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await connectionQuery.range(offset, offset + pageSize - 1);
    if (error) return NextResponse.json({ error: 'Unable to load export connections' }, { status: 500 });
    const page = data as ConnectionRow[];
    connections.push(...page);
    if (page.length < pageSize) break;
  }
  const providers = new Map(connections.flatMap((connection) => (
    connection.provider === 'google' || connection.provider === 'microsoft' ? [[connection.id, connection.provider] as const] : []
  )));
  const sourceById = new Map(sources.filter((source) => providers.has(source.connection_id)).map((source) => [source.id, source]));
  if (!sourceById.size) return responseFor(format, []);

  const range = {
    start: isoInstant(`${filters.start}T00:00:00`, 'Europe/Istanbul'),
    end: isoInstant(`${filters.end}T00:00:00`, 'Europe/Istanbul'),
  };
  const eventRows: EventRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin.from('calendar_events')
      .select('id, remote_event_id, connection_id, source_id, title, description, location, starts_at, ends_at, is_all_day, status')
      .eq('user_id', user.id).eq('status', 'confirmed').in('source_id', [...sourceById.keys()])
      .lt('starts_at', range.end).gt('ends_at', range.start).order('starts_at', { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) return NextResponse.json({ error: 'Unable to load export events' }, { status: 500 });
    const page = data as EventRow[];
    eventRows.push(...page);
    if (page.length < pageSize) break;
  }

  const events: ExportCalendarEvent[] = eventRows.flatMap((event) => {
    const source = sourceById.get(event.source_id);
    const provider = providers.get(event.connection_id);
    if (!source || !provider || source.connection_id !== event.connection_id) return [];
    return [{
      id: event.id, remoteEventId: event.remote_event_id, connectionId: event.connection_id, sourceId: event.source_id, sourceCalendarId: source.remote_calendar_id,
      provider, title: event.title, description: event.description, location: event.location, startsAt: event.starts_at, endsAt: event.ends_at,
      isAllDay: event.is_all_day, status: event.status, sourceName: source.name, sourceIsSelected: true,
    }];
  });
  return responseFor(format, events);
}
