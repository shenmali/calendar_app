import { expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), from: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { loadCalendarDataForUser } from '@/lib/calendar/server-data-loader';

test('normalizes production timestamp-backed all-day database bounds to bare Istanbul dates', async () => {
  mocks.createAdminClient.mockReturnValue({ from: mocks.from });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'calendar_events') return {
      select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: 'event-1', connection_id: 'connection-1', source_id: 'source-1', title: 'İzin', description: null, location: null, starts_at: '2026-01-14T21:00:00.000Z', ends_at: '2026-01-16T21:00:00.000Z', is_all_day: true, status: 'confirmed' }], error: null }) }) }),
    };
    if (table === 'calendar_sources') return {
      select: () => ({ eq: async () => ({ data: [{ id: 'source-1', connection_id: 'connection-1', remote_calendar_id: 'primary', name: 'İş', color: '#0284c7', is_selected: true }], error: null }) }),
    };
    return {
      select: () => ({ eq: async () => ({ data: [{ id: 'connection-1', provider: 'google', last_synced_at: null }], error: null }) }),
    };
  });

  const result = await loadCalendarDataForUser('owner-1');

  expect(result.events).toMatchObject([{ id: 'event-1', startsAt: '2026-01-15', endsAt: '2026-01-17', isAllDay: true }]);
});
