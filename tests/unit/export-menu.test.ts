import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';

import { ExportMenu } from '@/components/calendar/export-menu';

test('offers real format downloads that preserve the visible date and source filters', () => {
  const markup = renderToStaticMarkup(createElement(ExportMenu, {
    range: { start: '2026-01-01', end: '2027-01-01' }, sourceIds: ['source-a', 'source-b'],
  }));

  expect(markup).toContain('Dışa Aktar');
  expect(markup).toContain('/api/export/ics?start=2026-01-01&amp;end=2027-01-01&amp;sourceSelection=selected&amp;sourceId=source-a&amp;sourceId=source-b');
  expect(markup).toContain('/api/export/csv?start=2026-01-01&amp;end=2027-01-01&amp;sourceSelection=selected&amp;sourceId=source-a&amp;sourceId=source-b');
  expect(markup).toContain('/api/export/xlsx?start=2026-01-01&amp;end=2027-01-01&amp;sourceSelection=selected&amp;sourceId=source-a&amp;sourceId=source-b');
});

test('preserves an explicitly empty source selection instead of widening the export', () => {
  const markup = renderToStaticMarkup(createElement(ExportMenu, {
    range: { start: '2026-08-15', end: '2026-08-16' }, sourceIds: [],
  }));

  expect(markup).toContain('sourceSelection=selected');
  expect(markup).not.toContain('sourceId=');
});
