import { useState } from 'react'
import type { ApprovalRequest, EngineId, EngineStatus, Project, ThreadMeta } from '../../../shared/types'
import { EngineBadge } from './EngineBadge'

function ago(ms: number): string {
  const s = Math.max(1, Math.round((Date.now() - ms) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

interface Props {
  projects: Project[]
  threads: Record<string, ThreadMeta[]>
  project: string | null
  selected: string | null
  running: Set<string>
  approvals: ApprovalRequest[]
  status: Record<EngineId, EngineStatus>
  onSelectProject(path: string): void
  onOpenThread(t: ThreadMeta): void
  onNewThread(cwd?: string): void
  onAddProject(): void
  onDeleteThread(t: ThreadMeta): void
}

export function Sidebar(p: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <aside className="sidebar">
      <div className="sidebar-drag" />
      <button className="new-thread" onClick={() => p.onNewThread()} disabled={!p.project}>
        <span className="plus">+</span> New thread <kbd>⌘N</kbd>
      </button>

      <div className="sidebar-section">
        <div className="section-head">
          <span>Projects</span>
          <button className="icon-btn" onClick={p.onAddProject} title="Add project">
            +
          </button>
        </div>
        {p.projects.length === 0 && <div className="sidebar-empty">No projects yet</div>}
        {p.projects.map((proj) => {
          const list = p.threads[proj.path] ?? []
          const open = !collapsed[proj.path]
          return (
            <div key={proj.path} className="project">
              <div
                className={`project-row ${p.project === proj.path && !p.selected ? 'active' : ''}`}
                onClick={() => p.onSelectProject(proj.path)}
                title={proj.path}
              >
                <button
                  className={`chev ${open ? 'open' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setCollapsed((c) => ({ ...c, [proj.path]: open }))
                  }}
                >
                  ›
                </button>
                <span className="project-name">{proj.name}</span>
              </div>
              {open &&
                list.map((t) => {
                  const waiting = p.approvals.some((a) => a.key === t.key)
                  return (
                    <div
                      key={t.key}
                      className={`thread-row ${p.selected === t.key ? 'active' : ''}`}
                      onClick={() => p.onOpenThread(t)}
                    >
                      <EngineBadge engine={t.engine} bare />
                      <span className="thread-title">{t.title}</span>
                      {waiting ? (
                        <span className="pill warn">Needs approval</span>
                      ) : p.running.has(t.key) ? (
                        <span className="spinner" />
                      ) : (
                        <span className="thread-time">{ago(t.updatedAt)}</span>
                      )}
                      <button
                        className="thread-del"
                        title="Delete thread"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (confirm(`Delete "${t.title}" from Workbench?`)) p.onDeleteThread(t)
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>

      <div className="sidebar-foot">
        {(['codex', 'claude'] as EngineId[]).map((id) => {
          const s = p.status[id]
          return (
            <div key={id} className="engine-status" title={s.message ?? s.userAgent ?? ''}>
              <span className={`dot ${s.state}`} />
              {id === 'codex' ? 'codex app-server' : 'claude-app-server'}
              <span className="muted">{s.state === 'idle' ? 'not started' : s.state}</span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
