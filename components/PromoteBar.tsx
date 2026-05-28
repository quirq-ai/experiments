'use client';

import { useEffect, useState } from 'react';
import { FORMS, FORM_META, type Form } from '@/lib/types';

interface Props {
  onEvolve: (target: Form, prompt: string) => Promise<void> | void;
  busy: boolean;
  headForm?: Form;
}

export default function PromoteBar({ onEvolve, busy, headForm }: Props) {
  const [target, setTarget] = useState<Form>(suggestNext(headForm));
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    // When head changes (new artifact landed), advance the default target.
    setTarget(suggestNext(headForm));
  }, [headForm]);

  return (
    <div className="promote">
      <span style={{ color: 'var(--muted)', fontSize: 12 }}>Promote HEAD to</span>
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value as Form)}
        disabled={busy}
      >
        {FORMS.map((f) => (
          <option key={f} value={f}>
            {FORM_META[f].icon}  {FORM_META[f].label}
          </option>
        ))}
      </select>
      <input
        placeholder="(optional) prompt for the promotion"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !busy) {
            onEvolve(target, prompt);
            setPrompt('');
          }
        }}
        disabled={busy}
      />
      <button
        className="btn primary"
        disabled={busy}
        onClick={() => { onEvolve(target, prompt); setPrompt(''); }}
      >
        {busy ? 'Streaming...' : 'Evolve →'}
      </button>
      <span className="status">writes a new artifact dir on disk</span>
    </div>
  );
}

function suggestNext(from?: Form): Form {
  switch (from) {
    case 'terminal': return 'md';
    case 'md':       return 'deck';
    case 'deck':     return 'notebook';
    case 'notebook': return 'nextjs';
    case 'nextjs':   return 'nextjs';
    default:         return 'md';
  }
}
