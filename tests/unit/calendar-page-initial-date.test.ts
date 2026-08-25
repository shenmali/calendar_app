import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  loadCalendarDataForUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('@/lib/calendar/server-data-loader', () => ({ loadCalendarDataForUser: mocks.loadCalendarDataForUser }));

import CalendarPage from '@/app/(calendar)/page';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2027-02-03T20:30:00.000Z'));
  vi.stubGlobal('React', { createElement: (type: unknown, props: unknown) => ({ type, props }) });
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } });
  mocks.loadCalendarDataForUser.mockResolvedValue({ events: [], lastSyncedAt: null });
});

test('opens the annual calendar on the current Istanbul date instead of a fixed January date', async () => {
  const page = await CalendarPage();

  expect(page).not.toBeNull();
  expect(page!.props.initialDate).toBe('2027-02-03');
});
