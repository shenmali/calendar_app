import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { HorizontalYearRail } from '@/components/calendar/horizontal-year-rail';
import { buildYearMonths } from '@/lib/calendar/year-grid';

export function renderAnnualRailMarkup(): string {
  const rail = renderToStaticMarkup(createElement(HorizontalYearRail, {
    eventsByDay: new Map(),
    months: buildYearMonths(2026, 1),
    onSelectDate: () => undefined,
    selectedDate: '2026-01-15',
  }));

  return `<main class="p-4"><div class="calendar-year-rail min-w-0">${rail}</div></main>`;
}
