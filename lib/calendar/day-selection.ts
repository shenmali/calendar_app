type DaySelectionDependencies = {
  select: (date: string) => void;
  shouldReveal: () => boolean;
  reveal: () => void;
};

/** Runs reveal behavior for every tap, including a tap on the already selected date. */
export function selectCalendarDay(date: string, dependencies: DaySelectionDependencies): void {
  dependencies.select(date);
  if (dependencies.shouldReveal()) dependencies.reveal();
}
