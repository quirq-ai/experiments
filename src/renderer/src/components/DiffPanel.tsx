import { useEffect, useState } from 'react'
import type { GitDiff } from '../../../shared/types'

export function PatchView({ patch }: { patch: string }) {
  return (
    <pre className="patch">
      {patch.split('\n').map((l, i) => {
        const cls =
          l.startsWith('+++') || l.startsWith('---') || l.startsWith('diff ') || l.startsWith('index ')
            ? 'meta'
            : l.startsWith('@@')
              ? 'hunk'
              : l.startsWith('+')
                ? 'add'
                : l.startsWith('-')
                  ? 'del'
                  : ''
        return (
          <div key={i} className={`pl ${cls}`}>
            {l || ' '}
          </div>
        )
      })}
    </pre>
  )
}

function splitByFile(patch: string): { file: string; body: string }[] {
  const parts = patch.split(/^(?=diff --git )/m).filter((p) => p.trim())
  return parts.map((body) => {
    const m = body.match(/^diff --git a\/(.+?) b\/(.+)$/m)
    return { file: m?.[2] ?? 'changes', body }
  })
}

export function DiffPanel({ cwd, tick, onClose }: { cwd: string; tick: number; onClose(): void }) {
  const [diff, setDiff] = useState<GitDiff | null>(null)
  const [loading, setLoading] = useState(false)

  const load = () => {
    setLoading(true)
    window.workbench
      .gitDiff(cwd)
      .then(setDiff)
      .finally(() => setLoading(false))
  }
  useEffect(load, [cwd, tick])

  const files = diff ? splitByFile(diff.patch) : []

  return (
    <aside className="diff-panel">
      <header className="diff-head">
        <span>Changes</span>
        {diff?.branch && <span className="crumb">{diff.branch}</span>}
        <span className="spacer" />
        <button className="ghost-btn" onClick={load} disabled={loading}>
          {loading ? '…' : 'Refresh'}
        </button>
        <button className="icon-btn" onClick={onClose} title="Close">
          ×
        </button>
      </header>
      <div className="diff-body">
        {!diff ? null : !diff.isRepo ? (
          <div className="sidebar-empty">Not a git repository</div>
        ) : diff.files.length === 0 ? (
          <div className="sidebar-empty">No changes</div>
        ) : (
          <>
            <ul className="diff-files">
              {diff.files.map((f) => (
                <li key={f.path}>
                  <span className={`fstat s-${f.status.replace('?', 'u')}`}>{f.status}</span>
                  {f.path}
                </li>
              ))}
            </ul>
            {files.map((f) => (
              <details key={f.file} open className="diff-file">
                <summary>{f.file}</summary>
                <PatchView patch={f.body} />
              </details>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}
