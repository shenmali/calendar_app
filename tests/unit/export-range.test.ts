import { expect, test } from 'vitest';

import { activeExportRange } from '@/lib/calendar/export-range';

test('uses the active calendar view range rather than always exporting the whole year', () => {
  expect(activeExportRange('month', '2026-08-15', 2026)).toEqual({ start: '2026-08-01', end: '2026-09-01' });
  expect(activeExportRange('week', '2026-08-15', 2026)).toEqual({ start: '2026-08-10', end: '2026-08-17' });
  expect(activeExportRange('day', '2026-08-15', 2026)).toEqual({ start: '2026-08-15', end: '2026-08-16' });
  expect(activeExportRange('year', '2026-08-15', 2026)).toEqual({ start: '2026-01-01', end: '2027-01-01' });
});
