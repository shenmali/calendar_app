type SourceSelectionInput = {
  previousSourceIds: string[];
  selectedSourceIds: string[];
  nextSourceIds: string[];
};

export function initialSelectedSourceIds(sources: Array<{ id: string; isSelected: boolean }>): string[] {
  return sources.filter((source) => source.isSelected).map((source) => source.id);
}

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
