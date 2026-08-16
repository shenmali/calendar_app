import { expect, test } from 'vitest';

import { createCalendarDataLoader } from '@/lib/calendar/data-loader';

test('loads owner data with each source selection state preserved for the display', async () => {
  const requestedFor: string[] = [];
  const loader = createCalendarDataLoader({
    listEvents: async (userId) => {
      requestedFor.push(`events:${userId}`);
      return [
        { id: 'event-1', connectionId: 'connection-google', sourceId: 'source-work', title: 'Planlama', description: null, location: null, startsAt: '2026-01-15T07:00:00.000Z', endsAt: '2026-01-15T08:00:00.000Z', isAllDay: false, status: 'confirmed' as const },
        { id: 'event-2', connectionId: 'connection-microsoft', sourceId: 'source-personal', title: 'Aile', description: null, location: null, startsAt: '2026-01-15T16:00:00.000Z', endsAt: '2026-01-15T17:00:00.000Z', isAllDay: false, status: 'confirmed' as const },
      ];
    },
    listSources: async (userId) => {
      requestedFor.push(`sources:${userId}`);
      return [
        { id: 'source-work', connectionId: 'connection-google', remoteCalendarId: 'primary', name: 'İş', color: '#0284c7', isSelected: true },
        { id: 'source-personal', connectionId: 'connection-microsoft', remoteCalendarId: 'primary', name: 'Kişisel', color: '#7c3aed', isSelected: false },
      ];
    },
    listConnections: async (userId) => {
      requestedFor.push(`connections:${userId}`);
      return [
        { id: 'connection-google', provider: 'google' as const, lastSyncedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'connection-microsoft', provider: 'microsoft' as const, lastSyncedAt: '2026-01-02T00:00:00.000Z' },
      ];
    },
  });

  const result = await loader.loadForUser('owner-1');

  expect(requestedFor.sort()).toEqual(['connections:owner-1', 'events:owner-1', 'sources:owner-1']);
  expect(result.events).toMatchObject([
    { id: 'event-1', sourceId: 'source-work', sourceCalendarId: 'primary', provider: 'google', sourceName: 'İş', sourceIsSelected: true },
    { id: 'event-2', sourceId: 'source-personal', sourceCalendarId: 'primary', provider: 'microsoft', sourceName: 'Kişisel', sourceIsSelected: false },
  ]);
  expect(result.lastSyncedAt).toBe('2026-01-02T00:00:00.000Z');
});

test('does not expose orphaned rows when their owner-scoped source or connection is absent', async () => {
  const loader = createCalendarDataLoader({
    listEvents: async () => [{ id: 'event-1', connectionId: 'unknown-connection', sourceId: 'unknown-source', title: 'Görünmemeli', description: null, location: null, startsAt: '2026-01-15T07:00:00.000Z', endsAt: '2026-01-15T08:00:00.000Z', isAllDay: false, status: 'confirmed' as const }],
    listSources: async () => [],
    listConnections: async () => [],
  });

  expect(await loader.loadForUser('owner-1')).toEqual({ events: [], lastSyncedAt: null });
});
