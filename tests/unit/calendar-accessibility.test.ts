import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { DayCell } from '@/components/calendar/day-cell';
import { HorizontalYearRail } from '@/components/calendar/horizontal-year-rail';
import { SourceFilter } from '@/components/calendar/source-filter';
import { revealSelectedDayDetail } from '@/lib/calendar/detail-focus';
import { selectCalendarDay } from '@/lib/calendar/day-selection';
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

test('makes source filter labels a 44px touch target', () => {
  const markup = renderToStaticMarkup(createElement(SourceFilter, {
    onChange: () => undefined,
    selectedSourceIds: ['source-work'],
    sources: [{ id: 'source-work', name: 'Work', color: '#0284c7', isSelected: true }],
  }));
  expect(markup).toContain('min-h-11');
});

test('keeps populated day cells compact and touch-sized on mobile cards', () => {
  const markup = renderToStaticMarkup(createElement(DayCell, {
    date: '2026-01-15',
    events: [event, { ...event, id: 'event-2' }],
    isSelected: true,
    onSelect: () => undefined,
  }));

  expect(markup).toContain('min-h-11');
  expect(markup).toContain('aria-pressed="true"');
  const mobileEvents = markup.match(/<span class="sm:hidden" aria-label="2 etkinlik">([\s\S]*?)<\/span><span class="hidden sm:block">/)?.[1];
  expect(mobileEvents).toBeDefined();
  expect(mobileEvents).toMatch(/<span[^>]*aria-hidden="true"[^>]*class="[^"]*rounded-full[^"]*"[^>]*><\/span>/);
  expect(mobileEvents).toContain('>2</span>');
});

test('makes the year rail keyboard-focusable with horizontal pan and snap affordances', () => {
  const markup = renderToStaticMarkup(createElement(HorizontalYearRail, {
    eventsByDay: new Map([['2026-01-15', [event]]]),
    months: buildYearMonths(2026, 1),
    onSelectDate: () => undefined,
    selectedDate: '2026-01-15',
  }));

  const rail = railOpeningTag(markup);
  expect(rail).toContain('tabindex="0"');
  expect(rail).toContain('overflow-x-auto');
  expect(rail).toContain('snap-x');
  expect(rail).toContain('snap-mandatory');
});

test('scrolls and focuses the selected-day detail panel on mobile selection', () => {
  const calls: string[] = [];
  const panel = {
    scrollIntoView: (options: ScrollIntoViewOptions) => calls.push(`${options.behavior}:${options.block}`),
    focus: (options: FocusOptions) => calls.push(`focus:${String(options.preventScroll)}`),
  } as unknown as HTMLElement;

  revealSelectedDayDetail(panel);
  expect(calls).toEqual(['smooth:start', 'focus:true']);
});

test('reveals details even when tapping the already selected day', () => {
  const calls: string[] = [];
  selectCalendarDay('2026-01-15', {
    reveal: () => calls.push('reveal'),
    select: (date) => calls.push(date),
    shouldReveal: () => true,
  });
  expect(calls).toEqual(['2026-01-15', 'reveal']);
});
