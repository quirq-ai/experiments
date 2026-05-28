'use client';

import type { Artifact } from '@/lib/types';
import { FORM_META } from '@/lib/types';
import PreviewRenderer from './PreviewRenderer';

interface Props {
  runId: string;
  parent?: Artifact;
  child?: Artifact;
}

export default function DiffStage({ runId, parent, child }: Props) {
  if (!child) {
    return (
      <div className="diff-stage">
        <div className="diff-col" style={{ borderRight: 0 }}>
          <p style={{ color: 'var(--muted)' }}>Select an artifact.</p>
        </div>
      </div>
    );
  }
  const childMeta = FORM_META[child.form];
  const parentMeta = parent ? FORM_META[parent.form] : null;
  const diff = child.diff;

  return (
    <div className="diff-stage">
      <div className="diff-grid">
        <div className="diff-col">
          <h4>
            Parent
            {parent ? (
              <span className="pill">{parentMeta!.icon} {parent.id} · {parent.form}</span>
            ) : (
              <span className="pill" style={{ color: 'var(--muted)' }}>none</span>
            )}
          </h4>
          {parent ? (
            <PreviewRenderer
              form={parent.form}
              src={`/api/runs/${runId}/artifacts/${parent.id}`}
            />
          ) : (
            <p style={{ color: 'var(--muted-2)' }}>This is the seed artifact; there's no parent to diff against.</p>
          )}
        </div>
        <div className="diff-col">
          <h4>
            Child
            <span className="pill">{childMeta.icon} {child.id} · {child.form}</span>
          </h4>
          <PreviewRenderer
            form={child.form}
            src={`/api/runs/${runId}/artifacts/${child.id}`}
          />
        </div>
      </div>
      <div className="diff-meta">
        <div className={`card carry ${(!diff || diff.carryover.length === 0) ? 'empty' : ''}`}>
          <h5>Carried over</h5>
          {!diff || diff.carryover.length === 0 ? (
            <ul><li>no metadata</li></ul>
          ) : (
            <ul>{diff.carryover.map((c, i) => <li key={i}>{c}</li>)}</ul>
          )}
        </div>
        <div className={`card add ${(!diff || diff.added.length === 0) ? 'empty' : ''}`}>
          <h5>Added</h5>
          {!diff || diff.added.length === 0 ? (
            <ul><li>no metadata</li></ul>
          ) : (
            <ul>{diff.added.map((c, i) => <li key={i}>{c}</li>)}</ul>
          )}
        </div>
        <div className={`card drop ${(!diff || diff.dropped.length === 0) ? 'empty' : ''}`}>
          <h5>Dropped</h5>
          {!diff || diff.dropped.length === 0 ? (
            <ul><li>no metadata</li></ul>
          ) : (
            <ul>{diff.dropped.map((c, i) => <li key={i}>{c}</li>)}</ul>
          )}
        </div>
      </div>
    </div>
  );
}
