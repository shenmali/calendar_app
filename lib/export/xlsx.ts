import { utils, write } from 'xlsx-js-style';

import { exportColumns, toExportRow, type ExportCalendarEvent } from '@/lib/export/types';

/** Creates a valid, deterministic .xlsx workbook using values Excel can sort and filter. */
export function createXlsx(events: ExportCalendarEvent[]): Uint8Array {
  const sheet = utils.aoa_to_sheet([[...exportColumns], ...events.map(toExportRow)], { cellDates: true });
  sheet['!cols'] = [
    { wch: 32 }, { wch: 19 }, { wch: 19 }, { wch: 11 }, { wch: 24 }, { wch: 13 }, { wch: 24 }, { wch: 48 },
  ];
  sheet['!autofilter'] = { ref: `A1:H${Math.max(events.length + 1, 1)}` };
  for (let row = 2; row <= events.length + 1; row += 1) {
    for (const column of ['B', 'C']) {
      const cell = sheet[`${column}${row}`];
      if (cell) cell.z = events[row - 2].isAllDay ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm';
    }
  }
  for (const column of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
    const cell = sheet[`${column}1`];
    if (cell) cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '0F766E' } } };
  }
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, 'Etkinlikler');
  return new Uint8Array(write(workbook, { type: 'array', bookType: 'xlsx', compression: true, cellStyles: true }));
}
