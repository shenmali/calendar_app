import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { SourceFilter } from '@/components/calendar/source-filter';
import { revealSelectedDayDetail } from '@/lib/calendar/detail-focus';
import { selectCalendarDay } from '@/lib/calendar/day-selection';

test('makes source filter labels a 44px touch target', () => {
  const markup = renderToStaticMarkup(createElement(SourceFilter, {
    onChange: () => undefined,
    selectedSourceIds: ['source-work'],
    sources: [{ id: 'source-work', name: 'Work', color: '#0284c7', isSelected: true }],
  }));
  expect(markup).toContain('min-h-11');
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
