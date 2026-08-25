# Calendar Rail Visual Fidelity Design

## Goal

Replace the current card-grid year view with the annual planning rail requested in the source PDF and the supplied interactive reference. The result must read as a dense, calm planning surface rather than a collection of mini calendars.

## Visual model

- Months are stacked vertically in chronological order.
- Each month is one horizontally scrollable strip of day columns, not a 7-by-5 grid.
- Every day column shows its weekday, date, and compact event bars. A month may use one or two wrapped rows only when the viewport cannot display its complete date range without reducing day columns below the readable minimum.
- Weekend columns carry a restrained warm tint; today is blue; selection is a thin blue outline. Empty days remain visibly useful rather than becoming large empty cards.
- Month labels are quiet and aligned to the left. A large, low-contrast month numeral provides the PDF-inspired annual-planning rhythm without competing with event information.

## Desktop layout

- A lightweight, single-line top bar contains navigation, year, current-date action, connections, refresh, and export.
- The calendar rail occupies the primary column. It has no surrounding large rounded panel and no visible instruction text after first use.
- The selected-day inspector is a narrow sticky right column. It is visually subordinate, has a simple divider instead of a heavy card, and shows selected-day events, source colour, and empty state.
- The date rows retain natural horizontal scrolling with a clear but unobtrusive scrollbar. Month strips align their day-cell widths so movement is predictable.

## Mobile layout

- The exact month-strip model remains; it does not fall back to miniature month cards or a separate grid.
- Each strip spans the available width and scrolls horizontally with touch. Month titles remain in the document flow.
- Selecting a day opens its detail area directly below the active month strip. No permanently reserved empty side panel is shown.
- Primary actions collapse into a compact header; refresh and export remain reachable without obscuring the rail.

## Interaction and accessibility

- Existing date selection, source filtering, refresh, export, and keyboard semantics remain intact.
- Day controls preserve meaningful accessible labels and selected state.
- The selected month is brought into view on year changes only; date taps do not reset a user's horizontal position.
- Reduced-motion behavior remains respected.

## Non-goals

- No calendar editing or two-way provider sync is added.
- No change to data ownership, export formats, provider connections, or authentication.

## Acceptance criteria

1. The default year view has no 7-by-5 month-card grid.
2. Each visible month is a horizontal day strip with event bars and horizontal touch/mouse scrolling.
3. Desktop keeps the selected-day inspector beside the rail; mobile places it below the active rail.
4. The calendar feels visually consistent with the PDF's annual strip composition and the supplied reference's soft, low-chrome controls.
5. Existing annual, month, week, day, filter, refresh, connection, and export flows continue to work.
