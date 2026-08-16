import { YearGrid } from '@/components/calendar/year-grid';
import type { CalendarDisplayEvent, CalendarProvider } from '@/lib/calendar/types';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type CalendarEventRow = {
  id: string;
  connection_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  is_all_day: boolean;
  status: 'confirmed' | 'cancelled';
  calendar_sources: { remote_calendar_id: string; name: string; color: string | null }[];
  oauth_connections: { provider: string }[];
};

function calendarProvider(provider: string | undefined): CalendarProvider | null {
  return provider === 'google' || provider === 'microsoft' ? provider : null;
}

function toCalendarEvents(rows: CalendarEventRow[]): CalendarDisplayEvent[] {
  return rows.flatMap((row): CalendarDisplayEvent[] => {
    const provider = calendarProvider(row.oauth_connections[0]?.provider);
    const source = row.calendar_sources[0];
    if (!provider || !source) return [];
    return [{
      id: row.id,
      connectionId: row.connection_id,
      sourceCalendarId: source.remote_calendar_id,
      sourceName: source.name,
      sourceColor: source.color,
      provider,
      title: row.title,
      description: row.description,
      location: row.location,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      isAllDay: row.is_all_day,
      status: row.status,
    }];
  });
}

const demoEvents: CalendarDisplayEvent[] = [
  {
    id: 'demo-google-1', connectionId: 'demo-google', sourceCalendarId: 'work', sourceName: 'İş', sourceColor: '#0284c7', provider: 'google',
    title: 'Yıl planlama', description: null, location: 'Ofis', startsAt: '2026-01-15T07:00:00.000Z', endsAt: '2026-01-15T08:00:00.000Z', isAllDay: false,
    status: 'confirmed',
  },
  {
    id: 'demo-microsoft-1', connectionId: 'demo-microsoft', sourceCalendarId: 'home', sourceName: 'Kişisel', sourceColor: '#7c3aed', provider: 'microsoft',
    title: 'Aile yemeği', description: null, location: 'Kadıköy', startsAt: '2026-01-15T16:00:00.000Z', endsAt: '2026-01-15T18:00:00.000Z', isAllDay: false,
    status: 'confirmed',
  },
  {
    id: 'demo-google-2', connectionId: 'demo-google', sourceCalendarId: 'work', sourceName: 'İş', sourceColor: '#0284c7', provider: 'google',
    title: 'Tatil', description: null, location: null, startsAt: '2026-07-20T21:00:00.000Z', endsAt: '2026-07-21T21:00:00.000Z', isAllDay: true,
    status: 'confirmed',
  },
];

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from('calendar_events')
    .select('id, connection_id, title, description, location, starts_at, ends_at, is_all_day, status, calendar_sources!inner(remote_calendar_id, name, color), oauth_connections!inner(provider)')
    .eq('user_id', user.id)
    .order('starts_at', { ascending: true });

  const databaseEvents = error ? [] : toCalendarEvents((data ?? []) as CalendarEventRow[]);
  const events = !error && databaseEvents.length === 0 ? demoEvents : databaseEvents;

  return <YearGrid events={events} initialYear={2026} />;
}
