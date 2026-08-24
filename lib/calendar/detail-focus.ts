export function revealSelectedDayDetail(panel: HTMLElement, prefersReducedMotion = false): void {
  panel.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  panel.focus({ preventScroll: true });
}
