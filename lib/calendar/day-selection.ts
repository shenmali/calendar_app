type DaySelectionDependencies = {
  select: (date: string) => void;
  shouldReveal: () => boolean;
  reveal: () => void;
};

type SelectedMonthRevealInput = {
  isPhone: boolean;
  previousYear: string | null;
  selectedYear: string;
};

export function shouldRevealSelectedMonth({ isPhone, previousYear, selectedYear }: SelectedMonthRevealInput): boolean {
  return !isPhone || previousYear === null || previousYear !== selectedYear;
}

/** Runs reveal behavior for every tap, including a tap on the already selected date. */
export function selectCalendarDay(date: string, dependencies: DaySelectionDependencies): void {
  dependencies.select(date);
  if (dependencies.shouldReveal()) dependencies.reveal();
}
