import { expect, test } from 'vitest';

import { revealDateInStrip } from '@/lib/calendar/day-strip-reveal';

test('centres the selected day within its own horizontal strip', () => {
  const calls: ScrollToOptions[] = [];
  const selectedDay = { offsetLeft: 1_400, offsetWidth: 92 } as HTMLElement;
  const strip = {
    clientWidth: 390,
    offsetLeft: 120,
    querySelector: (selector: string) => selector === '[data-date="2026-01-15"]' ? selectedDay : null,
    scrollTo: (options: ScrollToOptions) => calls.push(options),
  } as unknown as HTMLElement;

  revealDateInStrip(strip, '2026-01-15', false);

  expect(calls).toEqual([{ behavior: 'smooth', left: 1_131 }]);
});

test('does not scroll when the requested day is absent', () => {
  const calls: ScrollToOptions[] = [];
  const strip = {
    clientWidth: 390,
    offsetLeft: 0,
    querySelector: () => null,
    scrollTo: (options: ScrollToOptions) => calls.push(options),
  } as unknown as HTMLElement;

  revealDateInStrip(strip, '2026-01-15', true);

  expect(calls).toEqual([]);
});
