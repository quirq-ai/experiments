// Stale shim: scrubber is now inlined inside RunView (work) and MovieStage
// (movie). Kept here for backward import safety.
'use client';

interface Props {
  count: number;
  index: number;
  onChange: (i: number) => void;
}

export default function Scrubber({ count, index, onChange }: Props) {
  if (count === 0) return null;
  return (
    <div className="scrubber">
      <input
        type="range"
        min={0}
        max={Math.max(0, count - 1)}
        step={1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="turn">{index + 1} / {count}</span>
    </div>
  );
}
