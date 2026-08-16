type SourceSelectionInput = {
  previousSourceIds: string[];
  selectedSourceIds: string[];
  nextSourceIds: string[];
};

/** Preserves user choices for known sources and selects only newly introduced source ids. */
export function reconcileSourceSelection({
  previousSourceIds, selectedSourceIds, nextSourceIds,
}: SourceSelectionInput): string[] {
  const nextSources = new Set(nextSourceIds);
  const previouslyKnown = new Set(previousSourceIds);
  const retained = selectedSourceIds.filter((sourceId) => nextSources.has(sourceId));
  const introduced = nextSourceIds.filter((sourceId) => !previouslyKnown.has(sourceId));
  return [...retained, ...introduced];
}
