'use client';

export type CalendarView = 'year' | 'month' | 'week' | 'day';

const views: Array<{ id: CalendarView; label: string }> = [
  { id: 'year', label: 'Yıl' },
  { id: 'month', label: 'Ay' },
  { id: 'week', label: 'Hafta' },
  { id: 'day', label: 'Gün' },
];

type ViewSwitcherProps = { view: CalendarView; onChange: (view: CalendarView) => void };

export function ViewSwitcher({ view, onChange }: ViewSwitcherProps) {
  return (
    <div aria-label="Takvim görünümü" className="flex items-center rounded-md border border-slate-300 bg-white p-0.5" role="group">
      {views.map((option) => (
        <button
          aria-pressed={view === option.id}
          className={`calendar-control border-0 shadow-none ${view === option.id ? 'bg-sky-700 text-white hover:bg-sky-800' : ''}`}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
