import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HorizontalYearRail } from '@/components/calendar/horizontal-year-rail';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';
import { buildYearMonths } from '@/lib/calendar/year-grid';

const populatedDayEvents: CalendarDisplayEvent[] = ['Planlama', 'Müşteri görüşmesi', 'Hazırlık notları'].map((title, index) => ({
  connectionId: 'connection-1',
  description: null,
  endsAt: '2026-01-16',
  id: `event-${index + 1}`,
  isAllDay: true,
  location: null,
  provider: 'google',
  sourceCalendarId: 'work',
  sourceColor: '#e11d48',
  sourceId: 'source-work',
  sourceIsSelected: true,
  startsAt: '2026-01-15',
  status: 'confirmed',
  title,
}));

export function renderAnnualRailMarkup(): string {
  const rail = renderToStaticMarkup(createElement(HorizontalYearRail, {
    eventsByDay: new Map([['2026-01-15', populatedDayEvents]]),
    months: buildYearMonths(2026, 1),
    onSelectDate: () => undefined,
    selectedDate: '2026-01-15',
  }));

  return `<main class="p-4"><div class="calendar-year-rail min-w-0">${rail}</div></main>`;
}
