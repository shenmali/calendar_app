# Calendar Rail Visual Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default annual calendar view match the supplied calendar PDF and reference site: vertically ordered months, each rendered as one horizontally scrollable sequence of days.

**Architecture:** Keep the existing calendar models, selection state, filtering, exports, authentication, and non-year views unchanged. Replace only the year-view presentation with semantic month strips backed by a new strip day component, then tighten the parent layout and toolbar around that composition.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-25-calendar-rail-visual-fidelity-design.md`

## Global Constraints

- The default `year` view must not render a 7×5 mini-month grid.
- Months are chronologically vertical; every month contains one independently horizontally scrollable day strip.
- The same strip pattern must remain usable at 320px wide with 44px minimum interactive targets.
- Preserve Istanbul date selection, source filtering, sync, exports, and the month/week/day views.
- Keep current keyboard semantics and selected-day detail behavior.

---

### Task 1: Prove the annual rail uses day strips rather than month cards

**Files:**
- Modify: `tests/unit/horizontal-year-rail.test.ts`
- Modify: `tests/e2e/year-rail-layout.spec.ts`
- Modify: `tests/fixtures/year-rail-markup.ts`

**Interfaces:**
- Consumes: `HorizontalYearRail({ months, eventsByDay, selectedDate, onSelectDate })`.
- Produces: regression checks for `[data-testid="month-day-strip"]`, chronological vertical month sections, and individual horizontal overflow.

- [x] **Step 1: Write the failing structural test**

```ts
expect(markup).toContain('data-testid="month-day-strip"');
expect(markup).not.toContain('grid-cols-7');
expect([...markup.matchAll(/data-testid="month-day-strip"/g)]).toHaveLength(12);
```

- [x] **Step 2: Write the failing phone-layout test**

```ts
const january = page.getByTestId('month-day-strip').first();
expect(await january.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
```

- [x] **Step 3: Run the focused tests to verify failure**

Run: `pnpm test -- --run tests/unit/horizontal-year-rail.test.ts` and `pnpm test:e2e -- tests/e2e/year-rail-layout.spec.ts`.

Expected: the new day-strip assertions fail against the existing horizontal row of 7×5 month cards.

- [x] **Step 4: Commit the red tests after the implementation task passes**

```bash
git add tests/unit/horizontal-year-rail.test.ts tests/e2e/year-rail-layout.spec.ts tests/fixtures/year-rail-markup.ts
git commit -m "test: specify annual day strip layout"
```

### Task 2: Replace the mini-month card with a semantic horizontal month strip

**Files:**
- Create: `components/calendar/month-day-strip.tsx`
- Modify: `components/calendar/horizontal-year-rail.tsx`
- Modify: `components/calendar/month-card.tsx`

**Interfaces:**
- Consumes: `MonthModel.weeks`, `Map<string, CalendarDisplayEvent[]>`, `selectedDate`, and `onSelectDate(date: string)`.
- Produces: `MonthDayStrip` with `data-testid="month-day-strip"`; every in-month date is a button named `"<day> <month> <year> gününü seç"`.

- [x] **Step 1: Flatten only actual dates in chronological order**

```ts
const days = month.weeks.flat().filter((day): day is CalendarDay & { date: string } => day.date !== null);
```

- [x] **Step 2: Render an individual overflow container per month**

```tsx
<div className="overflow-x-auto overscroll-x-contain" data-testid="month-day-strip" tabIndex={0}>
  <div className="flex min-w-max">{days.map(renderDay)}</div>
</div>
```

- [x] **Step 3: Render dense event bars and selection states**

```tsx
<button aria-pressed={isSelected} aria-label={`${formattedDate} gününü seç`} onClick={() => onSelectDate(day.date)} type="button">
  <span>{day.weekday}</span><time dateTime={day.date}>{dayNumber}</time>
</button>
```

- [x] **Step 4: Stack month sections vertically in `HorizontalYearRail`**

```tsx
<div className="space-y-5">{months.map((month) => <MonthCard key={monthKey} ... />)}</div>
```

- [x] **Step 5: Run Task 1 tests and unit suite**

Run: `pnpm test -- --run tests/unit/horizontal-year-rail.test.ts`.

Expected: PASS; twelve day-strip containers appear and no year-view mini-grid remains.

### Task 3: Tune annual shell, inspector, and mobile composition

**Files:**
- Modify: `components/calendar/calendar-toolbar.tsx`
- Modify: `components/calendar/year-grid.tsx`
- Modify: `app/globals.css`
- Modify: `tests/e2e/responsive-year-view.spec.ts`

**Interfaces:**
- Consumes: unchanged `CalendarToolbar` and `EventDetailPanel` props.
- Produces: a light single-line desktop toolbar, a subtle sticky desktop details region, and a details region after the rails on phones.

- [x] **Step 1: Update responsive assertions for vertically stacked headings**

```ts
expect(secondMonth?.y).toBeGreaterThan(firstMonth?.y ?? 0);
expect(secondMonth?.x).toBe(firstMonth?.x);
```

- [x] **Step 2: Simplify toolbar visual chrome without changing controls**

```tsx
<nav className="mb-6 border-b border-slate-200 pb-3" aria-label="Takvim araçları">...</nav>
```

- [x] **Step 3: Apply rail, weekend, today, selected, and scrollbar styles**

```css
.month-day-strip { scrollbar-color: #94a3b8 transparent; }
.month-day-strip__day--weekend { background: #fffaf5; }
.month-day-strip__day--selected { box-shadow: inset 0 0 0 2px #2563eb; }
```

- [x] **Step 4: Run the responsive visual behavior test**

Run: `pnpm test:e2e -- tests/e2e/responsive-year-view.spec.ts`.

Expected: PASS at the mobile viewport with no document-level horizontal overflow.

### Task 4: Verify production-ready visual regression coverage

**Files:**
- Modify: `docs/superpowers/specs/2026-08-25-calendar-rail-visual-fidelity-design.md`
- Modify: `docs/superpowers/plans/2026-08-25-calendar-rail-visual-fidelity.md`

**Interfaces:**
- Consumes: completed rail implementation and test coverage.
- Produces: verified test/build evidence and completed plan checkboxes.

- [x] **Step 1: Run all unit tests**

Run: `pnpm test -- --run`.

Expected: PASS.

- [x] **Step 2: Run the production build**

Run: `pnpm build`.

Expected: Next.js production build succeeds.

- [x] **Step 3: Start the local app and inspect desktop and phone dimensions**

Run: `pnpm dev` and use the browser at 1440px and 390px.

Expected: no mini-month grids, no page-level horizontal overflow, and readable event bars.

- [x] **Step 4: Mark verification items complete and commit**

```bash
git add components/calendar app/globals.css tests docs/superpowers
git commit -m "feat: rebuild annual calendar as day strips"
```
