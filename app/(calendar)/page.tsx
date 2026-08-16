import { YearGrid } from '@/components/calendar/year-grid';
import { loadCalendarDataForUser } from '@/lib/calendar/server-data-loader';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const calendarData = await loadCalendarDataForUser(user.id);
  return <YearGrid events={calendarData.events} initialYear={2026} lastSyncedAt={calendarData.lastSyncedAt} />;
}
