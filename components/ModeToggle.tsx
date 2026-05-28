'use client';

export type ViewMode = 'work' | 'diff' | 'movie';

interface Props {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
}

export default function ModeToggle({ value, onChange }: Props) {
  return (
    <div className="mode-toggle" role="tablist" aria-label="View mode">
      <button
        className={value === 'work' ? 'active' : ''}
        role="tab"
        aria-selected={value === 'work'}
        onClick={() => onChange('work')}
        title="Default work view"
      >
        Work
      </button>
      <button
        className={value === 'diff' ? 'active' : ''}
        role="tab"
        aria-selected={value === 'diff'}
        onClick={() => onChange('diff')}
        title="Parent vs child diff"
      >
        Diff
      </button>
      <button
        className={value === 'movie' ? 'active' : ''}
        role="tab"
        aria-selected={value === 'movie'}
        onClick={() => onChange('movie')}
        title="Full-screen auto-play (Esc to exit)"
      >
        ▶ Movie
      </button>
    </div>
  );
}
