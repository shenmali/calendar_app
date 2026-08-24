# Horizontal Calendar Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default annual grid with a scroll-snapping, single horizontal rail of twelve month cards that remains horizontal and touch-friendly on mobile.

**Architecture:** Keep the existing year/month/day model, event grouping, filters, sync, exports, and selected-day state intact. Introduce a presentational `HorizontalYearRail` responsible only for the annual rail’s semantic structure, card sizing, initial selected-month reveal, and scroll affordance. `YearGrid` continues to own state and becomes a responsive two-region composition: rail first and detail panel below on small screens, rail plus sticky detail panel on desktop.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-17-horizontal-calendar-rail-design.md`

## Global constraints

- Preserve the read-only calendar scope: this work must not add event-create, update, or delete actions.
- Preserve existing Supabase authorization boundaries, source selection, manual refresh, scheduled sync behavior, exports, and Istanbul date calculations.
- Keep all twelve months in chronological DOM order. They must never wrap into an annual grid at any breakpoint.
- The rail itself is the primary mobile view. Do not introduce a vertical month-list fallback.
- Do not alter the user-owned `.gitignore` change in this worktree.

## File map

- Create: `components/calendar/horizontal-year-rail.tsx`
- Modify: `components/calendar/year-grid.tsx`
- Modify: `components/calendar/month-card.tsx`
- Modify: `components/calendar/day-cell.tsx`
- Modify: `components/calendar/calendar-toolbar.tsx`
- Modify: `components/calendar/event-detail-panel.tsx`
- Modify: `app/globals.css`
- Create: `tests/unit/horizontal-year-rail.test.ts`
- Modify: `tests/unit/calendar-accessibility.test.ts`
- Modify: `tests/e2e/year-view.spec.ts`
- Modify: `tests/e2e/responsive-year-view.spec.ts`
- Modify: `tests/e2e/calendar-views.spec.ts`

### Task 1: Lock down the horizontal-rail contract with failing tests

**Files:**
- Create: `tests/unit/horizontal-year-rail.test.ts`
- Modify: `tests/unit/calendar-accessibility.test.ts`
- Modify: `tests/e2e/year-view.spec.ts`
- Modify: `tests/e2e/responsive-year-view.spec.ts`
- Modify: `tests/e2e/calendar-views.spec.ts`

- [ ] **Step 1: Write the unit-level rendering contract before creating the rail component.**
  - Render `HorizontalYearRail` with `buildYearMonths(2026, 1)` and a small `eventsByDay` fixture using `renderToStaticMarkup`.
  - Assert the rail is labelled `Yıl ayları`, has `data-testid="year-rail"`, contains twelve level-two month headings in the exact `Ocak` through `Aralık` order, and exposes an assistive hint that the months scroll horizontally.
  - Assert the selected month has a stable anchor/data attribute, so the browser behavior can target it without matching localized heading text.

- [ ] **Step 2: Extend the existing accessibility test with the visual-density contract.**
  - Render a populated `DayCell` for a mobile-sized card and assert its control retains `min-h-11`, `aria-pressed`, and the compact event-count/dot representation.
  - Add static-markup checks that the rail has keyboard focusability and horizontal pan/snap classes, rather than asserting browser layout from unit tests.

- [ ] **Step 3: Rewrite desktop Playwright expectations for one continuous rail.**
  - In `tests/e2e/year-view.spec.ts`, replace `year-grid` lookups with `year-rail`; retain the accessible main, toolbar, detail panel, selected-day, and no-create-control assertions.
  - Add a layout assertion that the rail has `scrollWidth > clientWidth`, first and third month headings share the same vertical position, and the visible rail can be scrolled to a later month.

- [ ] **Step 4: Rewrite responsive Playwright expectations for mobile horizontal behavior.**
  - In `tests/e2e/responsive-year-view.spec.ts`, assert at 390 px that the rail appears before the detail panel in document layout, the day target is at least 44 px tall, and the second month is horizontally offset rather than below the first.
  - Programmatically set the rail’s `scrollLeft`, then assert it changes and a later heading becomes visible; this proves a real horizontal scroll container rather than a flex row clipped by the page.
  - Keep the existing selected-day detail-focus assertion, adapting it only if the accessibility policy changes focus behavior in Task 3.

- [ ] **Step 5: Update the view-switching regression test.**
  - In `tests/e2e/calendar-views.spec.ts`, use `year-rail` as the default/returning annual view identifier while preserving month, week, day URL-state coverage.

- [ ] **Step 6: Run the targeted tests and confirm they fail for the expected missing rail behavior.**
  - Run: `pnpm test -- horizontal-year-rail calendar-accessibility`
  - Expected before implementation: import/component or rail selector failures; do not weaken assertions to make the current grid pass.

- [ ] **Step 7: Commit the red tests.**
  - Run: `git add tests/unit/horizontal-year-rail.test.ts tests/unit/calendar-accessibility.test.ts tests/e2e/year-view.spec.ts tests/e2e/responsive-year-view.spec.ts tests/e2e/calendar-views.spec.ts && git commit -m "test: define horizontal calendar rail behavior"`

### Task 2: Build the rail component and preserve the calendar-data boundary

**Files:**
- Create: `components/calendar/horizontal-year-rail.tsx`
- Modify: `components/calendar/month-card.tsx`
- Modify: `components/calendar/day-cell.tsx`
- Modify: `components/calendar/year-grid.tsx`
- Test: `tests/unit/horizontal-year-rail.test.ts`

- [ ] **Step 1: Create `HorizontalYearRail` as a client component with narrow props.**
  - Accept `months: MonthModel[]`, `eventsByDay: Map<string, CalendarDisplayEvent[]>`, `selectedDate`, and `onSelectDate`; do not pass sync, auth, export, or provider concerns into it.
  - Render one labelled section containing one focusable scroll container and one non-wrapping flex track. Map `months` once in source order, passing the existing selection callback directly to each `MonthCard`.
  - Use `data-testid="year-rail"` on the scroll container and `data-month="YYYY-MM"` on each card wrapper. Generate the month key/identifier from `month.month` and the selected year parsed from `selectedDate`.

- [ ] **Step 2: Implement accessible horizontal movement and selected-month reveal.**
  - Give the scroll container `tabIndex={0}`, an explicit `aria-label` such as `Ay şeridi`, and a visually modest instruction connected through `aria-describedby` that says months can be scrolled horizontally.
  - Use a `useEffect` keyed by the selected month/year to call `scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })` on that card after initial render and after year/today navigation.
  - Respect reduced-motion preferences by using `behavior: 'auto'` when `window.matchMedia('(prefers-reduced-motion: reduce)').matches` is true. Do not scroll the full document.

- [ ] **Step 3: Give cards a stable rail size without permitting wrap.**
  - Extend `MonthCard` with an optional `className` and `data-month`/id-friendly props, preserving all current consumers.
  - On the rail card wrapper use `shrink-0 snap-start`; set a phone width around `86vw` and a practical desktop width around `22rem`/`24rem`. Ensure rail padding leaves a sliver of the next card visible on narrow screens.
  - Keep headings unique by including the year in their id (the current `month-${month.month}` duplicates if multiple calendar instances ever render); use this stable id as the `aria-labelledby` target.

- [ ] **Step 4: Tune `DayCell` for the compact card rhythm without changing selection semantics.**
  - Preserve the 44 px mobile target and current date/button labels.
  - Make mobile dots/count the default concise signal and limit desktop event labels to the existing visible/remaining logic so a long event never grows the card vertically.
  - Add non-colour cues for selected state, today, weekend, and empty cells: selection ring/label, today outline or date badge, muted weekend background, and neutral empty cells. Derive weekday styling from the ISO date only; do not use the browser timezone.

- [ ] **Step 5: Replace only the `view === 'year'` branch in `YearGrid`.**
  - Remove the responsive `grid-cols-*` annual section and import/render `HorizontalYearRail` in its place.
  - Keep `months`, `eventsByDay`, filtering, selected-event computation, source reconciliation, manual refresh, and query-string view state unchanged. This protects multi-day and cross-year event placement supplied by `groupEventsByDay`.
  - Preserve the other three views unchanged; only the default annual surface changes.

- [ ] **Step 6: Run the focused unit suite until green.**
  - Run: `pnpm test -- horizontal-year-rail year-grid calendar-accessibility event-selectors`
  - Expected: the new rail tests pass; existing Monday-first month/data tests remain green.

- [ ] **Step 7: Commit the component implementation.**
  - Run: `git add components/calendar/horizontal-year-rail.tsx components/calendar/month-card.tsx components/calendar/day-cell.tsx components/calendar/year-grid.tsx tests/unit/horizontal-year-rail.test.ts tests/unit/calendar-accessibility.test.ts && git commit -m "feat: render annual calendar as horizontal rail"`

### Task 3: Make the surrounding layout deliberate on desktop and mobile

**Files:**
- Modify: `components/calendar/year-grid.tsx`
- Modify: `components/calendar/calendar-toolbar.tsx`
- Modify: `components/calendar/event-detail-panel.tsx`
- Modify: `app/globals.css`
- Test: `tests/e2e/year-view.spec.ts`
- Test: `tests/e2e/responsive-year-view.spec.ts`

- [ ] **Step 1: Recompose the year view’s rail/detail regions.**
  - On small screens render the rail before the `EventDetailPanel`, placing selected-day details immediately below it.
  - At the desktop breakpoint, use a two-column layout with `minmax(0, 1fr)` for the rail and a roughly `19rem` detail column. Keep the detail panel sticky at the same breakpoint and ensure the rail column itself has `min-w-0` so it can scroll instead of widening the page.
  - Do not reorder month/week/day views unless necessary for their existing detail-panel behavior.

- [ ] **Step 2: Rework the toolbar into intentional mobile rows.**
  - Keep year navigation and `Bugün` together as the first logical row.
  - Place view switching, source filters, connection management, refresh, and export into a second wrapping row with `w-full`/responsive grouping rather than `ml-auto` forcing off-screen overflow.
  - Maintain button names, source labels, 44 px control sizing, sync-status live region, and all existing callbacks.

- [ ] **Step 3: Refine the detail panel for the mobile-after-rail position.**
  - Use compact mobile spacing while preserving semantic `<aside>`, `aria-live="polite"`, focusability, and full event information.
  - Retain sticky behavior only for desktop; do not make the panel sticky over the rail on a phone.
  - Keep `selectCalendarDay`/`revealSelectedDayDetail` behavior coherent: a tapped date should reveal the nearby panel without moving the rail or the full-page focus unexpectedly. If focus is retained for the current accessibility test, document it in a concise code comment beside the conditional.

- [ ] **Step 4: Add minimal global rail affordance styles.**
  - Add a component-layer class for readable horizontal scrollbar/focus styling only if Tailwind utilities cannot express it. Do not hide the scrollbar completely; it is an important desktop affordance.
  - Respect `prefers-reduced-motion` for snap/reveal transitions and avoid site-wide overscroll changes that could affect dialogs or other views.

- [ ] **Step 5: Run lint and browser verification.**
  - Run: `pnpm lint`
  - Run: `pnpm test:e2e` with the authenticated Playwright storage state when available. If the state is absent, record that its auth-gated tests are skipped; do not bypass login to turn them green.
  - Manually check at 1440 px and 390 px: months stay in one row, the next card edge is visible, horizontal scrolling works, a day tap selects it, detail content appears below the rail on mobile/alongside on desktop, and toolbar controls do not create page-level horizontal overflow.

- [ ] **Step 6: Commit the responsive polish.**
  - Run: `git add components/calendar/year-grid.tsx components/calendar/calendar-toolbar.tsx components/calendar/event-detail-panel.tsx app/globals.css tests/e2e/year-view.spec.ts tests/e2e/responsive-year-view.spec.ts tests/e2e/calendar-views.spec.ts && git commit -m "feat: optimize horizontal calendar rail for mobile"`

### Task 4: Full regression, production build, and deployment handoff

**Files:**
- Verify only; no product-file change is expected unless verification exposes a real defect.

- [ ] **Step 1: Run the full automated suite.**
  - Run: `pnpm test`
  - Run: `pnpm exec tsc --noEmit --incremental false`
  - Run: `pnpm lint`
  - Run: `pnpm build`
  - Expected: existing sync/auth/member-management tests still pass, and the production prebuild owner provisioning remains compatible with the rail-only UI change.

- [ ] **Step 2: Inspect the final diff for scope and safety.**
  - Run: `git diff --check`
  - Run: `git status --short`
  - Confirm only the plan’s UI/test files are staged or committed; leave the pre-existing `.gitignore` modification untouched.

- [ ] **Step 3: Push and deploy through the existing GitHub/Vercel path.**
  - Push branch `codex/personal-calendar` to `origin`; update the existing draft PR rather than creating a duplicate.
  - Let Vercel build from the PR/production branch according to the existing project configuration. Verify the deployment has the project’s existing Supabase environment variables and does not expose the service-role key to the client.

- [ ] **Step 4: Validate the live authenticated experience.**
  - Visit `https://calendar.mashen.dev` as an authorized account; confirm unauthenticated access still redirects to `/login`.
  - Verify the same desktop/mobile rail behaviors and one manual refresh action in production. Confirm exports and connected source filters remain visible and that no event-write UI was introduced.

- [ ] **Step 5: Commit any verification-only fix separately if needed.**
  - Run only if a real corrective change is required: `git add <specific files> && git commit -m "fix: address horizontal rail regression"`

