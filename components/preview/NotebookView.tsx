'use client';

interface NotebookCell {
  cell_type: 'markdown' | 'code' | string;
  source: string | string[];
  outputs?: Array<{
    output_type: string;
    name?: string;
    text?: string | string[];
    data?: Record<string, string | string[]>;
  }>;
  execution_count?: number | null;
}

interface NotebookJson { cells: NotebookCell[]; }

interface Props {
  text: string;
  streaming?: boolean;
}

export default function NotebookView({ text, streaming }: Props) {
  let nb: NotebookJson | null = null;
  let err: string | null = null;
  try { nb = JSON.parse(text); } catch (e: any) { err = streaming ? null : String(e?.message ?? e); }

  if (err) return <pre style={{ color: 'var(--deck)' }}>{err}</pre>;
  if (!nb) {
    if (streaming) {
      // While the notebook JSON is mid-stream and unparseable, show the raw
      // stream as a monospace block with a "building cells..." note.
      return (
        <div className="nb">
          <div className="cell">
            <div className="in" style={{ color: 'var(--muted)' }}>building cells...</div>
            <pre style={{ opacity: 0.7 }}>{text.slice(-1200)}</pre>
          </div>
        </div>
      );
    }
    return <p style={{ color: 'var(--muted)' }}>Loading notebook...</p>;
  }

  return (
    <div className="nb">
      {nb.cells.map((c, i) => (
        <div className="cell" key={i}>
          {c.cell_type === 'code' && (
            <div className="in">In [{c.execution_count ?? ' '}]:</div>
          )}
          <pre>{toText(c.source)}</pre>
          {c.outputs?.map((o, j) => (
            <div className="out" key={j}>
              {o.text ? toText(o.text) : o.data?.['text/plain'] ? toText(o.data['text/plain']) : '[non-text output]'}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function toText(s: string | string[] | undefined): string {
  if (!s) return '';
  return Array.isArray(s) ? s.join('') : s;
}
