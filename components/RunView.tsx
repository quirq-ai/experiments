'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Artifact, Form, Run, RunEvent } from '@/lib/types';
import Rail from './Rail';
import PromoteBar from './PromoteBar';
import ModeToggle, { type ViewMode } from './ModeToggle';
import WorkStage from './WorkStage';
import MovieStage from './MovieStage';
import DiffStage from './DiffStage';

interface Props {
  initialRun: Run;
}

interface StreamState {
  promotionId: string;
  targetForm: Form;
  parentId: string;
  text: string;
}

export default function RunView({ initialRun }: Props) {
  const [run, setRun] = useState<Run>(initialRun);
  const initialSel = initialRun.head || initialRun.artifacts.at(-1)?.id || '';
  const [selectedId, setSelectedId] = useState<string>(initialSel);
  const [mode, setMode] = useState<ViewMode>('work');
  const [streaming, setStreaming] = useState<StreamState | null>(null);
  const [newId, setNewId] = useState<string | null>(null); // for pop animation
  const sseRef = useRef<EventSource | null>(null);

  const selected: Artifact | undefined = useMemo(
    () => run.artifacts.find((a) => a.id === selectedId),
    [run, selectedId],
  );
  const parent: Artifact | undefined = useMemo(
    () => (selected?.parent_id ? run.artifacts.find((a) => a.id === selected.parent_id) : undefined),
    [run, selected],
  );

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/runs/${run.id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const { run: latest } = (await res.json()) as { run: Run };
    setRun(latest);
    return latest;
  }, [run.id]);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/runs/${run.id}/events`);
    sseRef.current = es;
    es.onmessage = (m) => {
      let evt: RunEvent;
      try { evt = JSON.parse(m.data) as RunEvent; } catch { return; }
      switch (evt.type) {
        case 'promotion_started':
          setStreaming({
            promotionId: evt.promotion_id,
            targetForm: evt.target_form,
            parentId: evt.parent_id,
            text: '',
          });
          break;
        case 'promotion_chunk':
          setStreaming((s) =>
            s && s.promotionId === evt.promotion_id ? { ...s, text: s.text + evt.delta } : s,
          );
          break;
        case 'promotion_finalized':
          setStreaming(null);
          refresh().then(() => {
            setSelectedId(evt.artifact.id);
            setNewId(evt.artifact.id);
            setTimeout(() => setNewId(null), 800);
          });
          break;
        case 'promotion_failed':
          setStreaming(null);
          alert(`promotion failed: ${evt.error}`);
          break;
        case 'head_moved':
        case 'artifact_created':
          // refresh quietly; promotion_finalized already handles selection
          refresh();
          break;
        default:
          break;
      }
    };
    return () => { es.close(); sseRef.current = null; };
  }, [run.id, refresh]);

  // body class for movie mode
  useEffect(() => {
    if (mode === 'movie') document.body.classList.add('movie-on');
    else document.body.classList.remove('movie-on');
    return () => { document.body.classList.remove('movie-on'); };
  }, [mode]);

  // ESC exits movie mode
  useEffect(() => {
    if (mode !== 'movie') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('work');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  const onEvolve = useCallback(
    async (targetForm: Form, prompt: string) => {
      await fetch(`/api/runs/${run.id}/evolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_form: targetForm, prompt: prompt || undefined }),
      });
      // SSE handles the rest (promotion_started -> chunks -> finalized)
    },
    [run.id],
  );

  const idx = Math.max(0, run.artifacts.findIndex((a) => a.id === selectedId));

  if (mode === 'movie') {
    return (
      <MovieStage
        runId={run.id}
        artifacts={run.artifacts}
        index={idx}
        title={run.title}
        onIndex={(i) => setSelectedId(run.artifacts[i]?.id ?? selectedId)}
        onExit={() => setMode('work')}
      />
    );
  }

  return (
    <>
      <div className="run-head" style={{ marginTop: 0, marginBottom: 14 }}>
        <span style={{ color: 'var(--muted)', fontSize: 12 }}>
          {run.artifacts.length} artifacts · head <code style={{ color: 'var(--text)' }}>{run.head}</code>
        </span>
        <div className="spacer" />
        <ModeToggle value={mode} onChange={setMode} />
      </div>

      {mode === 'work' ? (
        <WorkStage
          runId={run.id}
          run={run}
          artifact={selected}
          streaming={streaming && (selected?.id === run.head) ? streaming : streaming /* show overlay regardless */}
        />
      ) : (
        <DiffStage runId={run.id} parent={parent} child={selected} />
      )}

      <div className="rail-wrap">
        <div className="rail-head">
          <h2>Rail</h2>
          <div className="spacer" />
          <div className="scrubber" style={{ minWidth: 280 }}>
            <input
              type="range"
              min={0}
              max={Math.max(0, run.artifacts.length - 1)}
              step={1}
              value={idx}
              onChange={(e) => setSelectedId(run.artifacts[Number(e.target.value)]?.id ?? selectedId)}
            />
            <span className="turn">{idx + 1} / {run.artifacts.length}</span>
          </div>
        </div>
        <Rail
          artifacts={run.artifacts}
          activeId={selectedId}
          newId={newId}
          streamingTarget={streaming?.targetForm}
          onSelect={setSelectedId}
        />
      </div>

      <PromoteBar onEvolve={onEvolve} busy={!!streaming} headForm={run.artifacts.find(a => a.id === run.head)?.form} />
    </>
  );
}
