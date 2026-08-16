'use client';

export type CalendarSourceFilter = {
  id: string;
  name: string;
  color: string;
};

type SourceFilterProps = {
  sources: CalendarSourceFilter[];
  selectedSourceIds: string[];
  onChange: (sourceIds: string[]) => void;
};

export function SourceFilter({ sources, selectedSourceIds, onChange }: SourceFilterProps) {
  const selectedSources = new Set(selectedSourceIds);

  function toggleSource(sourceId: string) {
    const next = selectedSources.has(sourceId)
      ? selectedSourceIds.filter((id) => id !== sourceId)
      : [...selectedSourceIds, sourceId];
    onChange(next);
  }

  return (
    <fieldset className="flex flex-wrap items-center gap-x-3 gap-y-2 border-0 p-0">
      <legend className="sr-only">Kaynak filtreleri</legend>
      {sources.map((source) => (
        <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-700" key={source.id}>
          <input
            checked={selectedSources.has(source.id)}
            className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            onChange={() => toggleSource(source.id)}
            type="checkbox"
          />
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: source.color }} />
          {source.name}
        </label>
      ))}
    </fieldset>
  );
}
