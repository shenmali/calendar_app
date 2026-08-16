export function revealSelectedDayDetail(panel: HTMLElement): void {
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panel.focus({ preventScroll: true });
}
