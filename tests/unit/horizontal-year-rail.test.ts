import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { HorizontalYearRail } from '@/components/calendar/horizontal-year-rail';
import { buildYearMonths } from '@/lib/calendar/year-grid';
import type { CalendarDisplayEvent } from '@/lib/calendar/types';

const event: CalendarDisplayEvent = {
  id: 'event-1', connectionId: 'google-connection', sourceId: 'source-work', sourceCalendarId: 'work', provider: 'google', title: 'Planlama', description: null, location: null,
  startsAt: '2026-01-15T09:00:00.000Z', endsAt: '2026-01-15T10:00:00.000Z', isAllDay: false, status: 'confirmed', sourceIsSelected: true,
};

function railOpeningTag(markup: string): string {
  const rail = markup.match(/<[^>]*data-testid="year-rail"[^>]*>/)?.[0];
  expect(rail).toBeDefined();
  return rail ?? '';
}

function selectedMonthOpeningTag(markup: string): string {
  const selectedMonth = markup.match(/<[^>]*data-selected-month="0"[^>]*>/)?.[0];
  expect(selectedMonth).toBeDefined();
  return selectedMonth ?? '';
}

test('renders all months in chronological horizontal-rail order with a selected-month target', () => {
  const markup = renderToStaticMarkup(createElement(HorizontalYearRail, {
    eventsByDay: new Map([['2026-01-15', [event]]]),
    months: buildYearMonths(2026, 1),
    onSelectDate: () => undefined,
    selectedDate: '2026-01-15',
  }));

  const rail = railOpeningTag(markup);
  expect(rail).toContain('aria-label="Yıl ayları"');
  expect(rail).toContain('data-testid="year-rail"');
  expect([...markup.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1])).toEqual([
    'Ocak 2026', 'Şubat 2026', 'Mart 2026', 'Nisan 2026', 'Mayıs 2026', 'Haziran 2026',
    'Temmuz 2026', 'Ağustos 2026', 'Eylül 2026', 'Ekim 2026', 'Kasım 2026', 'Aralık 2026',
  ]);
  expect(markup).toContain('Aylar yatay olarak kaydırılabilir');
  const selectedMonth = selectedMonthOpeningTag(markup);
  expect(selectedMonth).toContain('aria-labelledby="month-2026-01"');
  expect(selectedMonth).toContain('data-month="2026-01"');
  expect(markup).toMatch(/<h2[^>]*id="month-2026-01"[^>]*>Ocak 2026<\/h2>/);
});
