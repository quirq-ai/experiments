'use client';

import type { Artifact, Form } from '@/lib/types';
import { FORM_META } from '@/lib/types';

interface Props {
  artifacts: Artifact[];
  activeId: string;
  newId: string | null;
  streamingTarget?: Form;
  onSelect: (id: string) => void;
}

export default function Rail({ artifacts, activeId, newId, streamingTarget, onSelect }: Props) {
  return (
    <div className="rail">
      {artifacts.map((a, i) => {
        const meta = FORM_META[a.form];
        const active = a.id === activeId;
        const isNew = a.id === newId;
        return (
          <div
            key={a.id}
            className={`node ${a.form} ${active ? 'active' : ''} ${isNew ? 'new' : ''}`}
            onClick={() => onSelect(a.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(a.id); }}
            title={a.summary}
          >
            <div className="node-tile" aria-hidden>{meta.icon}</div>
            <div className="lbl">{meta.label}</div>
            <div className="ver">{a.id} · #{i + 1}</div>
          </div>
        );
      })}
      {streamingTarget && (
        <div className={`node ${streamingTarget} placeholder`} aria-hidden>
          <div className="node-tile">…</div>
          <div className="lbl">streaming</div>
          <div className="ver">→ {streamingTarget}</div>
        </div>
      )}
    </div>
  );
}
