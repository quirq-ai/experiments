'use client';

import { useEffect, useRef, useState } from 'react';
import type { Artifact } from '@/lib/types';
import { FORM_META } from '@/lib/types';
import PreviewRenderer from './PreviewRenderer';

interface Props {
  runId: string;
  artifacts: Artifact[];
  index: number;
  title: string;
  onIndex: (i: number) => void;
  onExit: () => void;
}

export default function MovieStage({ runId, artifacts, index, title, onIndex, onExit }: Props) {
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = setInterval(() => {
      const next = index + 1;
      if (next >= artifacts.length) {
        setPlaying(false);
      } else {
        onIndex(next);
      }
    }, 4500);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, index, artifacts.length, onIndex]);

  const current = artifacts[index];
  if (!current) return null;
  const meta = FORM_META[current.form];
  const pct = artifacts.length > 1 ? (index / (artifacts.length - 1)) * 100 : 100;

  return (
    <div className="movie-fullscreen">
      <div className="movie-top">
        <span className="title">{title}</span>
        <span>·</span>
        <span>{current.id}</span>
        <span className="form-pill" style={{ borderColor: 'var(--' + colorFor(current.form) + ')', color: 'var(--' + colorFor(current.form) + ')' }}>
          {meta.icon} {meta.label}
        </span>
        <div className="spacer" />
        <button className="btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? '⏸ Pause' : '▶ Play'}
        </button>
        <button className="btn" onClick={onExit}>Exit ▢</button>
      </div>

      <div className="movie-stage">
        <div className="movie-art" key={current.id /* re-trigger fade-up on change */}>
          <PreviewRenderer
            form={current.form}
            src={`/api/runs/${runId}/artifacts/${current.id}`}
            big
          />
        </div>
      </div>

      <div className="movie-prog">
        <div className="bar" style={{ width: `${pct}%` }} />
      </div>

      <div className="movie-bot">
        <button className="btn" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0}>← prev</button>
        <div className="scrubber">
          <input
            type="range"
            min={0}
            max={Math.max(0, artifacts.length - 1)}
            step={1}
            value={index}
            onChange={(e) => onIndex(Number(e.target.value))}
          />
          <span className="turn">{index + 1} / {artifacts.length}</span>
        </div>
        <button className="btn" onClick={() => onIndex(Math.min(artifacts.length - 1, index + 1))} disabled={index === artifacts.length - 1}>next →</button>
      </div>
    </div>
  );
}

function colorFor(form: string): string {
  return ({
    terminal: 'term',
    md: 'md',
    deck: 'deck',
    notebook: 'nb',
    nextjs: 'app',
  } as Record<string, string>)[form] ?? 'muted';
}
