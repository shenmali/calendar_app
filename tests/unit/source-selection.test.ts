import { expect, test } from 'vitest';

import { reconcileSourceSelection } from '@/lib/calendar/source-selection';

test('auto-selects sources introduced by the first refresh while retaining selected initial sources', () => {
  expect(reconcileSourceSelection({
    previousSourceIds: ['source-work'],
    selectedSourceIds: ['source-work'],
    nextSourceIds: ['source-work', 'source-personal'],
  })).toEqual(['source-work', 'source-personal']);
});

test('preserves an intentional deselection while adding only genuinely new sources', () => {
  expect(reconcileSourceSelection({
    previousSourceIds: ['source-work', 'source-personal'],
    selectedSourceIds: ['source-work'],
    nextSourceIds: ['source-work', 'source-personal', 'source-family'],
  })).toEqual(['source-work', 'source-family']);
});

test('does not change mount-time selections when source ids are unchanged', () => {
  expect(reconcileSourceSelection({
    previousSourceIds: ['source-work', 'source-personal'],
    selectedSourceIds: ['source-work'],
    nextSourceIds: ['source-work', 'source-personal'],
  })).toEqual(['source-work']);
});
