import type { CalendarDisplayEvent, CalendarProvider } from '@/lib/calendar/types';

type EventRow = {
  id: string;
  connectionId: string;
  sourceId: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  status: 'confirmed' | 'cancelled';
};

type SourceRow = {
  id: string;
  connectionId: string;
  remoteCalendarId: string;
  name: string;
  color: string | null;
  isSelected: boolean;
};

type ConnectionRow = {
  id: string;
  provider: CalendarProvider;
  lastSyncedAt: string | null;
};

type CalendarDataDependencies = {
  listEvents: (userId: string) => Promise<EventRow[]>;
  listSources: (userId: string) => Promise<SourceRow[]>;
  listConnections: (userId: string) => Promise<ConnectionRow[]>;
};

export type CalendarData = {
  events: CalendarDisplayEvent[];
  lastSyncedAt: string | null;
};

function latestSyncAt(connections: ConnectionRow[]): string | null {
  return connections.reduce<string | null>((latest, connection) => {
    if (!connection.lastSyncedAt) return latest;
    return !latest || connection.lastSyncedAt > latest ? connection.lastSyncedAt : latest;
  }, null);
}

export function createCalendarDataLoader(dependencies: CalendarDataDependencies) {
  return {
    async loadForUser(userId: string): Promise<CalendarData> {
      const [events, sources, connections] = await Promise.all([
        dependencies.listEvents(userId), dependencies.listSources(userId), dependencies.listConnections(userId),
      ]);
      const sourcesById = new Map(sources.map((source) => [source.id, source]));
      const connectionsById = new Map(connections.map((connection) => [connection.id, connection]));
      const displayEvents = events.flatMap((event): CalendarDisplayEvent[] => {
        const source = sourcesById.get(event.sourceId);
        const connection = connectionsById.get(event.connectionId);
        if (!source || !connection || source.connectionId !== connection.id) return [];
        return [{
          ...event,
          sourceCalendarId: source.remoteCalendarId,
          sourceName: source.name,
          sourceColor: source.color,
          sourceIsSelected: source.isSelected,
          provider: connection.provider,
        }];
      });
      return { events: displayEvents, lastSyncedAt: latestSyncAt(connections) };
    },
  };
}
