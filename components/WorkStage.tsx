'use client';

import type { Artifact, Form, Run } from '@/lib/types';
import { FORM_META } from '@/lib/types';
import PreviewRenderer from './PreviewRenderer';

interface Props {
  runId: string;
  run: Run;
  artifact?: Artifact;
  streaming: { promotionId: string; targetForm: Form; parentId: string; text: string } | null;
}

export default function WorkStage({ runId, run, artifact, streaming }: Props) {
  if (!artifact) {
    return (
      <div className="work-stage">
        <div className="work-art">
          <p style={{ color: 'var(--muted)' }}>Select an artifact from the rail.</p>
        </div>
        <div className="work-meta" />
      </div>
    );
  }
  const meta = FORM_META[artifact.form];
  return (
    <div className="work-stage">
      <div className="work-art">
        <div className="art-head">
          <span className={`art-tag ${artifact.form}`}>
            {meta.icon} {meta.label}
          </span>
          <h2 className="art-title">{meta.entry}</h2>
          <span className="art-path">runs/{run.id}/{artifact.content_ref}</span>
        </div>
        <PreviewRenderer
          form={artifact.form}
          src={`/api/runs/${runId}/artifacts/${artifact.id}`}
        />
      </div>

      <div className="work-meta">
        <div className="meta-block">
          <h3>Prompt</h3>
          <div className="prompt">{artifact.prompt}</div>
        </div>
        <div className="meta-block">
          <h3>Summary</h3>
          <p className="summary">{artifact.summary}</p>
        </div>
        <div className="meta-block">
          <h3>Metadata</h3>
          <dl>
            <dt>id</dt>     <dd className="mono">{artifact.id}</dd>
            <dt>form</dt>   <dd className="mono">{artifact.form}</dd>
            <dt>parent</dt> <dd className="mono">{artifact.parent_id ?? 'null'}</dd>
            <dt>source</dt> <dd className="mono">{artifact.source ?? 'seed'}</dd>
            <dt>head?</dt>  <dd className="mono">{run.head === artifact.id ? 'yes' : 'no'}</dd>
            <dt>at</dt>     <dd className="mono">{relTime(artifact.created_at)}</dd>
          </dl>
        </div>
        {artifact.diff && (artifact.diff.carryover.length || artifact.diff.added.length) ? (
          <div className="meta-block">
            <h3>Diff (vs parent)</h3>
            <DiffPills diff={artifact.diff} />
          </div>
        ) : null}
      </div>

      {streaming && (
        <div className="stream-overlay">
          <div className="stream-bar">
            <span className="pulse" />
            <span>claude · streaming</span>
            <span className="target">→ <b>{streaming.targetForm}</b></span>
            <span className="spacer" />
            <span className="chars">{streaming.text.length.toLocaleString()} chars</span>
          </div>
          <div className="stream-body">
            <PreviewRenderer form={streaming.targetForm} liveText={streaming.text} streaming />
          </div>
        </div>
      )}
    </div>
  );
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function DiffPills({ diff }: { diff: { carryover: string[]; added: string[]; dropped: string[] } }) {
  const Pill = ({ items, color, label }: { items: string[]; color: string; label: string }) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color, marginBottom: 4 }}>
        {label} ({items.length})
      </div>
      {items.length === 0 ? (
        <div style={{ color: 'var(--muted-2)', fontSize: 11, fontStyle: 'italic' }}>none</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#cdd5be' }}>
          {items.slice(0, 4).map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </div>
  );
  return (
    <>
      <Pill items={diff.carryover} color="var(--xo)" label="carried over" />
      <Pill items={diff.added} color="var(--nb)" label="added" />
      <Pill items={diff.dropped} color="var(--deck)" label="dropped" />
    </>
  );
}
