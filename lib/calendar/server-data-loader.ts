import 'server-only';

import { createCalendarDataLoader, type CalendarData } from '@/lib/calendar/data-loader';
import type { CalendarProvider } from '@/lib/calendar/types';
import { createAdminClient } from '@/lib/supabase/admin';

type AdminEventRow = {
  id: string;
  connection_id: string;
  source_id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  is_all_day: boolean;
  status: 'confirmed' | 'cancelled';
};

type AdminSourceRow = {
  id: string;
  connection_id: string;
  remote_calendar_id: string;
  name: string;
  color: string | null;
};

type AdminConnectionRow = {
  id: string;
  provider: CalendarProvider;
  last_synced_at: string | null;
};

/** Reads three safe projections with an explicit owner predicate after session authentication. */
export async function loadCalendarDataForUser(userId: string): Promise<CalendarData> {
  const admin = createAdminClient();
  const loader = createCalendarDataLoader({
    async listEvents(ownerId) {
      const { data, error } = await admin
        .from('calendar_events')
        .select('id, connection_id, source_id, title, description, location, starts_at, ends_at, is_all_day, status')
        .eq('user_id', ownerId)
        .order('starts_at', { ascending: true });
      if (error) throw new Error('Unable to load calendar events');
      return (data as AdminEventRow[]).map((row) => ({
        id: row.id, connectionId: row.connection_id, sourceId: row.source_id, title: row.title, description: row.description,
        location: row.location, startsAt: row.starts_at, endsAt: row.ends_at, isAllDay: row.is_all_day, status: row.status,
      }));
    },
    async listSources(ownerId) {
      const { data, error } = await admin
        .from('calendar_sources')
        .select('id, connection_id, remote_calendar_id, name, color')
        .eq('user_id', ownerId);
      if (error) throw new Error('Unable to load calendar sources');
      return (data as AdminSourceRow[]).map((row) => ({
        id: row.id, connectionId: row.connection_id, remoteCalendarId: row.remote_calendar_id, name: row.name, color: row.color,
      }));
    },
    async listConnections(ownerId) {
      const { data, error } = await admin
        .from('oauth_connections')
        .select('id, provider, last_synced_at')
        .eq('user_id', ownerId);
      if (error) throw new Error('Unable to load calendar connections');
      return (data as AdminConnectionRow[]).flatMap((row) => (
        row.provider === 'google' || row.provider === 'microsoft'
          ? [{ id: row.id, provider: row.provider, lastSyncedAt: row.last_synced_at }]
          : []
      ));
    },
  });
  return loader.loadForUser(userId);
}
