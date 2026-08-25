/** Centres a selected date in its own horizontally scrollable month strip. */
export function revealDateInStrip(strip: HTMLElement, date: string, reducedMotion: boolean): void {
  const day = strip.querySelector<HTMLElement>(`[data-date="${date}"]`);
  if (!day) return;

  const left = Math.max(0, day.offsetLeft - strip.offsetLeft - ((strip.clientWidth - day.offsetWidth) / 2));
  strip.scrollTo({ behavior: reducedMotion ? 'auto' : 'smooth', left });
}
