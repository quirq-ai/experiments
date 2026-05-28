// Artifact evolution type model.
// One Run holds many Artifact nodes. Each Artifact is immutable; promotion
// creates a new node with parent_id pointing back to its predecessor.

export const FORMS = ['terminal', 'md', 'deck', 'notebook', 'nextjs'] as const;
export type Form = (typeof FORMS)[number];

export const FORM_META: Record<
  Form,
  { label: string; icon: string; color: string; ext: string; entry: string }
> = {
  terminal: { label: 'Terminal',    icon: '⌨',  color: 'var(--term)', ext: 'cast', entry: 'session.cast' },
  md:       { label: 'One-pager',   icon: '📄', color: 'var(--md)',   ext: 'md',   entry: 'onepager.md' },
  deck:     { label: 'Deck',        icon: '▦',  color: 'var(--deck)', ext: 'html', entry: 'index.html' },
  notebook: { label: 'Notebook',    icon: '🧪', color: 'var(--nb)',   ext: 'ipynb', entry: 'notebook.ipynb' },
  nextjs:   { label: 'Next.js app', icon: '◬',  color: 'var(--app)',  ext: 'html', entry: 'index.html' },
};

/** Optional semantic diff metadata between an artifact and its parent. */
export interface DiffMeta {
  /** concepts / lines / sections carried over from the parent */
  carryover: string[];
  /** new substance the new form introduces */
  added: string[];
  /** anything materially dropped */
  dropped: string[];
}

export interface Artifact {
  /** stable id, e.g. "v01" */
  id: string;
  /** parent artifact id, or null for the first node in a run */
  parent_id: string | null;
  run_id: string;
  form: Form;
  /** path under /runs/{run_id}, e.g. "v02-md/onepager.md" */
  content_ref: string;
  /** user message that produced this artifact */
  prompt: string;
  /** one-line tooltip / summary */
  summary: string;
  /** ISO timestamp */
  created_at: string;
  /** optional diff metadata vs parent (filled by promoter) */
  diff?: DiffMeta;
  /** promoter that produced this artifact: "mock" | "anthropic" | "seed" */
  source?: string;
}

export interface Run {
  id: string;
  title: string;
  /** current head artifact id (latest visible version) */
  head: string;
  /** ordered append-only list; promotion appends; order is creation order */
  artifacts: Artifact[];
  created_at: string;
}

export type RunSummary = Pick<Run, 'id' | 'title' | 'created_at'> & {
  artifacts: { id: string; form: Form }[];
};

/** Wire event types streamed over /runs/{id}/events (SSE). */
export type RunEvent =
  | { type: 'artifact_created'; run_id: string; artifact: Artifact }
  | { type: 'head_moved'; run_id: string; head: string }
  | { type: 'promotion_started'; run_id: string; promotion_id: string; target_form: Form; parent_id: string }
  | { type: 'promotion_chunk'; run_id: string; promotion_id: string; delta: string }
  | { type: 'promotion_finalized'; run_id: string; promotion_id: string; artifact: Artifact }
  | { type: 'promotion_failed'; run_id: string; promotion_id: string; error: string }
  | { type: 'ping'; ts: string };

/** Payload accepted by POST /runs/{id}/evolve */
export interface EvolveRequest {
  target_form: Form;
  prompt?: string;
}
