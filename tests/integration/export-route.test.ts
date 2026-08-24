import { NextRequest } from 'next/server';
import { beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), createServerClient: vi.fn(), from: vi.fn(), getUser: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createServerClient }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.createAdminClient }));

import { GET } from '@/app/api/export/[format]/route';

const user = { id: '8cb947a5-7cd8-41f9-ab11-b294df96d8ca' };
const sourceId = '90cab0d1-e98d-492a-9cd3-4ef9f8bb01f8';
const connectionId = '10721c2c-eebf-496b-a84e-6895b02dbff3';

function query(result: unknown) {
  const builder = {
    eq: vi.fn(), in: vi.fn(), lt: vi.fn(), gt: vi.fn(), order: vi.fn(), range: vi.fn(),
  };
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  builder.gt.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockResolvedValue(result);
  return builder;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.createAdminClient.mockReturnValue({ from: mocks.from });
});

test('exports only authenticated owner events matching repeated source filters with download headers', async () => {
  const sources = query({ data: [{ id: sourceId, connection_id: connectionId, remote_calendar_id: 'primary', name: 'İş' }], error: null });
  const connections = query({ data: [{ id: connectionId, provider: 'google' }], error: null });
  const events = query({ data: [{ id: 'event-1', remote_event_id: 'g-42', connection_id: connectionId, source_id: sourceId, title: 'Planlama', description: null, location: null, starts_at: '2026-08-15T07:00:00.000Z', ends_at: '2026-08-15T08:00:00.000Z', is_all_day: false, status: 'confirmed' }], error: null });
  mocks.from.mockImplementation((table: string) => ({ select: vi.fn(() => table === 'calendar_sources' ? sources : table === 'oauth_connections' ? connections : events) }));

  const response = await GET(
    new NextRequest(`https://calendar.example.com/api/export/csv?start=2026-08-01&end=2026-09-01&sourceId=${sourceId}&sourceId=${sourceId}`),
    { params: Promise.resolve({ format: 'csv' }) },
  );

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('text/csv');
  expect(response.headers.get('content-disposition')).toContain('calendar-export.csv');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.text()).toContain('Başlık,Başlangıç,Bitiş,Tüm Gün,Konum,Kaynak,Takvim,Açıklama');
  expect(sources.eq).toHaveBeenCalledWith('user_id', user.id);
  expect(sources.in).toHaveBeenCalledWith('id', [sourceId]);
  expect(events.eq).toHaveBeenCalledWith('user_id', user.id);
  expect(events.eq).toHaveBeenCalledWith('status', 'confirmed');
  expect(events.in).toHaveBeenCalledWith('source_id', [sourceId]);
  expect(events.range).toHaveBeenCalledWith(0, 499);
  expect(sources.order).toHaveBeenCalledWith('id', { ascending: true });
  expect(connections.order).toHaveBeenCalledWith('id', { ascending: true });
  expect(events.order).toHaveBeenCalledWith('id', { ascending: true });
});

test('rejects invalid date ranges and unknown formats without querying event data', async () => {
  const malformed = await GET(
    new NextRequest('https://calendar.example.com/api/export/csv?start=2026-09-01&end=2026-08-01'),
    { params: Promise.resolve({ format: 'csv' }) },
  );
  const unknown = await GET(
    new NextRequest('https://calendar.example.com/api/export/pdf?start=2026-08-01&end=2026-09-01'),
    { params: Promise.resolve({ format: 'pdf' }) },
  );
  const impossibleDate = await GET(
    new NextRequest('https://calendar.example.com/api/export/csv?start=2026-02-30&end=2026-03-02'),
    { params: Promise.resolve({ format: 'csv' }) },
  );

  expect(malformed.status).toBe(400);
  expect(unknown.status).toBe(404);
  expect(impossibleDate.status).toBe(400);
  expect(mocks.from).not.toHaveBeenCalled();
});

test('does not widen an explicitly empty source selection', async () => {
  const response = await GET(
    new NextRequest('https://calendar.example.com/api/export/csv?start=2026-08-01&end=2026-09-01&sourceSelection=selected'),
    { params: Promise.resolve({ format: 'csv' }) },
  );

  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain('Planlama');
  expect(mocks.from).not.toHaveBeenCalled();
});

test('filters all-day events with Istanbul-exclusive date boundaries', async () => {
  const sources = query({ data: [{ id: sourceId, connection_id: connectionId, remote_calendar_id: 'primary', name: 'İş' }], error: null });
  const connections = query({ data: [{ id: connectionId, provider: 'google' }], error: null });
  const events = query({ data: [
    { id: 'old', remote_event_id: 'old', connection_id: connectionId, source_id: sourceId, title: 'Eski', description: null, location: null, starts_at: '2026-08-13T21:00:00.000Z', ends_at: '2026-08-14T21:00:00.000Z', is_all_day: true, status: 'confirmed' },
    { id: 'today', remote_event_id: 'today', connection_id: connectionId, source_id: sourceId, title: 'Bugün', description: null, location: null, starts_at: '2026-08-14T21:00:00.000Z', ends_at: '2026-08-15T21:00:00.000Z', updated_at: '2026-08-01T00:00:00.000Z', is_all_day: true, status: 'confirmed' },
  ], error: null });
  mocks.from.mockImplementation((table: string) => ({ select: vi.fn(() => table === 'calendar_sources' ? sources : table === 'oauth_connections' ? connections : events) }));

  const response = await GET(
    new NextRequest(`https://calendar.example.com/api/export/csv?start=2026-08-15&end=2026-08-16&sourceId=${sourceId}`),
    { params: Promise.resolve({ format: 'csv' }) },
  );

  const csv = await response.text();
  expect(csv).toContain('Bugün');
  expect(csv).toContain('Bugün,2026-08-15,2026-08-16,Evet');
  expect(csv).not.toContain('Eski');
});

test('chunks repeated source filters before querying', async () => {
  const requestedIds = Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  const sources = query({ data: [], error: null });
  mocks.from.mockReturnValue({ select: vi.fn(() => sources) });

  const response = await GET(
    new NextRequest(`https://calendar.example.com/api/export/csv?start=2026-08-01&end=2026-09-01&${requestedIds.map((id) => `sourceId=${id}`).join('&')}`),
    { params: Promise.resolve({ format: 'csv' }) },
  );

  expect(response.status).toBe(200);
  expect(sources.in.mock.calls.every(([, ids]) => (ids as string[]).length <= 100)).toBe(true);
});

test('paginates selected sources so an export is not silently capped', async () => {
  const firstPage = Array.from({ length: 500 }, (_, index) => ({ id: `source-${index}`, connection_id: `connection-${index}`, remote_calendar_id: 'primary', name: 'Ignored' }));
  const sources = query({ data: [], error: null });
  sources.range
    .mockResolvedValueOnce({ data: firstPage, error: null })
    .mockResolvedValueOnce({ data: [{ id: sourceId, connection_id: connectionId, remote_calendar_id: 'primary', name: 'İş' }], error: null });
  const connections = query({ data: [{ id: connectionId, provider: 'google' }], error: null });
  const events = query({ data: [], error: null });
  mocks.from.mockImplementation((table: string) => ({ select: vi.fn(() => table === 'calendar_sources' ? sources : table === 'oauth_connections' ? connections : events) }));

  const response = await GET(
    new NextRequest('https://calendar.example.com/api/export/ics?start=2026-08-01&end=2026-09-01'),
    { params: Promise.resolve({ format: 'ics' }) },
  );

  expect(response.status).toBe(200);
  expect(sources.range).toHaveBeenNthCalledWith(1, 0, 499);
  expect(sources.range).toHaveBeenNthCalledWith(2, 500, 999);
});
