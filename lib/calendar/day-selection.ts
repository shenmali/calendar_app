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
  void isPhone;
  return previousYear === null || previousYear !== selectedYear;
}

/** Moves a calendar date by whole months while keeping the nearest valid day. */
export function moveCalendarMonth(date: string, amount: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match || !Number.isInteger(amount)) throw new Error('Expected an ISO date and whole-month increment');
  const [, rawYear, rawMonth, rawDay] = match;
  const target = new Date(Date.UTC(Number(rawYear), Number(rawMonth) - 1 + amount, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(Number(rawDay), lastDay)).padStart(2, '0')}`;
}

/** Runs reveal behavior for every tap, including a tap on the already selected date. */
export function selectCalendarDay(date: string, dependencies: DaySelectionDependencies): void {
  dependencies.select(date);
  if (dependencies.shouldReveal()) dependencies.reveal();
}
