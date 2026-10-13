import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ApprovalDecision, Model } from '../../shared/protocol'
import { applyNotification, emptyTranscript, type Transcript } from '../../shared/transcript'
import type {
  ApprovalRequest,
  EngineId,
  EngineStatus,
  Project,
  ThreadKey,
  ThreadMeta,
  TurnSettings
} from '../../shared/types'
import { Sidebar } from './components/Sidebar'
import { TranscriptView } from './components/Transcript'
import { Composer } from './components/Composer'
import { DiffPanel } from './components/DiffPanel'
import { EngineBadge } from './components/EngineBadge'

const api = window.workbench

const DEFAULT_SETTINGS: Record<EngineId, TurnSettings> = {
  codex: { model: '', effort: null, access: 'agent' },
  claude: { model: 'claude-opus-5-5', effort: null, access: 'agent' }
}

function loadSettings(): Record<EngineId, TurnSettings> {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('workbench.settings') ?? '{}') }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [threads, setThreads] = useState<Record<string, ThreadMeta[]>>({})
  const [project, setProject] = useState<string | null>(null)
  const [selected, setSelected] = useState<ThreadKey | null>(null)
  const [draftEngine, setDraftEngine] = useState<EngineId>(
    () => (localStorage.getItem('workbench.engine') as EngineId) || 'claude'
  )
  const [transcripts, setTranscripts] = useState<Record<ThreadKey, Transcript>>({})
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [models, setModels] = useState<Partial<Record<EngineId, Model[]>>>({})
  const [settings, setSettings] = useState(loadSettings)
  const [status, setStatus] = useState<Record<EngineId, EngineStatus>>({
    codex: { engine: 'codex', state: 'idle' },
    claude: { engine: 'claude', state: 'idle' }
  })
  const [diffOpen, setDiffOpen] = useState(false)
  const [diffTick, setDiffTick] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  const allThreads = useMemo(() => Object.values(threads).flat(), [threads])
  const meta = allThreads.find((t) => t.key === selected) ?? null
  const engine: EngineId = meta?.engine ?? draftEngine
  const transcript = selected ? transcripts[selected] : undefined
  const running = !!transcript?.activeTurnId

  const refreshThreads = useCallback(async (cwd: string) => {
    const list = await api.listThreads(cwd)
    setThreads((t) => ({ ...t, [cwd]: list }))
  }, [])

  // Boot: projects, engine status, pending approvals, event stream.
  useEffect(() => {
    void (async () => {
      const ps = await api.listProjects()
      setProjects(ps)
      for (const p of ps) void refreshThreads(p.path)
      const last = localStorage.getItem('workbench.project')
      setProject(ps.find((p) => p.path === last)?.path ?? ps[0]?.path ?? null)
      for (const s of await api.engineStatus()) setStatus((m) => ({ ...m, [s.engine]: s }))
      setApprovals(await api.pendingApprovals())
    })()
    return api.onEvent((e) => {
      switch (e.type) {
        case 'notification':
          setTranscripts((all) => {
            const cur = all[e.key]
            if (!cur) return all
            const next = applyNotification(cur, e.method, e.params)
            return next === cur ? all : { ...all, [e.key]: next }
          })
          if (e.method === 'turn/completed' && e.key === selectedRef.current) setDiffTick((n) => n + 1)
          break
        case 'approval':
          setApprovals((a) => [...a, e.request])
          break
        case 'approval-resolved':
          setApprovals((a) => a.filter((r) => r.requestKey !== e.requestKey))
          break
        case 'thread-updated':
          setThreads((t) => ({
            ...t,
            [e.meta.cwd]: [e.meta, ...(t[e.meta.cwd] ?? []).filter((x) => x.key !== e.meta.key)].sort(
              (a, b) => b.updatedAt - a.updatedAt
            )
          }))
          break
        case 'engine-status':
          setStatus((m) => ({ ...m, [e.status.engine]: e.status }))
          break
      }
    })
  }, [refreshThreads])

  useEffect(() => {
    if (project) localStorage.setItem('workbench.project', project)
  }, [project])
  useEffect(() => localStorage.setItem('workbench.settings', JSON.stringify(settings)), [settings])
  useEffect(() => localStorage.setItem('workbench.engine', draftEngine), [draftEngine])

  // Model list per engine (starts that engine's app-server on first use).
  useEffect(() => {
    if (models[engine]) return
    api
      .listModels(engine)
      .then((list) => {
        setModels((m) => ({ ...m, [engine]: list }))
        setSettings((s) => {
          const cur = s[engine]
          if (cur.model && list.some((m) => m.id === cur.model)) return s
          const def = list.find((m) => m.isDefault) ?? list[0]
          return def ? { ...s, [engine]: { ...cur, model: def.id, effort: null } } : s
        })
      })
      .catch((e) => setError(`${engine}: ${(e as Error).message}`))
  }, [engine, models])

  const openThread = useCallback(async (t: ThreadMeta) => {
    setSelected(t.key)
    setProject(t.cwd)
    setError(null)
    const tr = await api.getTranscript(t.key)
    setTranscripts((all) => ({ ...all, [t.key]: all[t.key] ?? tr }))
  }, [])

  const newThread = useCallback((cwd?: string) => {
    if (cwd) setProject(cwd)
    setSelected(null)
    setError(null)
  }, [])

  const addProject = useCallback(async () => {
    const p = await api.addProject()
    if (!p) return
    setProjects((ps) => (ps.some((x) => x.path === p.path) ? ps : [...ps, p]))
    setProject(p.path)
    setSelected(null)
    void refreshThreads(p.path)
  }, [refreshThreads])

  const send = useCallback(
    async (text: string) => {
      if (!project) return
      setError(null)
      const s = settings[engine]
      try {
        let key = selected
        if (!key) {
          const m = await api.createThread(engine, project, s)
          key = m.key
          setThreads((t) => ({ ...t, [project]: [m, ...(t[project] ?? [])] }))
          setTranscripts((all) => ({ ...all, [m.key]: emptyTranscript() }))
          setSelected(m.key)
        }
        await api.send(key, text, s)
      } catch (e) {
        setError((e as Error).message)
      }
    },
    [engine, project, selected, settings]
  )

  const stop = useCallback(() => {
    if (selected) void api.interrupt(selected)
  }, [selected])

  const respond = useCallback((r: ApprovalRequest, d: ApprovalDecision) => {
    void api.respondApproval(r.requestKey, d)
  }, [])

  const deleteThread = useCallback(
    async (t: ThreadMeta) => {
      await api.deleteThread(t.key)
      setThreads((all) => ({ ...all, [t.cwd]: (all[t.cwd] ?? []).filter((x) => x.key !== t.key) }))
      if (selected === t.key) setSelected(null)
    },
    [selected]
  )

  // ⌘N new thread, ⌘D toggle diff.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return
      if (e.key === 'n') {
        e.preventDefault()
        newThread()
      } else if (e.key === 'd') {
        e.preventDefault()
        setDiffOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newThread])

  const projectName = projects.find((p) => p.path === project)?.name
  const threadApprovals = approvals.filter((a) => a.key === selected)
  const runningKeys = useMemo(
    () => new Set(Object.entries(transcripts).filter(([, t]) => t.activeTurnId).map(([k]) => k)),
    [transcripts]
  )

  return (
    <div className={`app ${diffOpen ? 'with-diff' : ''}`}>
      <Sidebar
        projects={projects}
        threads={threads}
        project={project}
        selected={selected}
        running={runningKeys}
        approvals={approvals}
        status={status}
        onSelectProject={(p) => newThread(p)}
        onOpenThread={openThread}
        onNewThread={newThread}
        onAddProject={addProject}
        onDeleteThread={deleteThread}
      />

      <main className="main">
        <header className="topbar">
          <div className="topbar-title">
            {meta ? (
              <>
                <span className="title-text">{meta.title}</span>
                <EngineBadge engine={meta.engine} />
              </>
            ) : (
              <span className="title-text muted">New thread</span>
            )}
          </div>
          <div className="topbar-actions">
            {projectName && <span className="crumb">{projectName}</span>}
            <button
              className={`ghost-btn ${diffOpen ? 'active' : ''}`}
              onClick={() => setDiffOpen((v) => !v)}
              title="Toggle diff (⌘D)"
              disabled={!project}
            >
              Diff
            </button>
          </div>
        </header>

        {!project ? (
          <div className="empty">
            <h1>Workbench</h1>
            <p className="muted">One workspace, two engines: Codex and Claude Code.</p>
            <button className="primary-btn" onClick={addProject}>
              Open a project folder
            </button>
          </div>
        ) : !selected ? (
          <div className="empty">
            <h1>What should we build in {projectName}?</h1>
            <div className="engine-switch" role="tablist">
              {(['codex', 'claude'] as EngineId[]).map((id) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={draftEngine === id}
                  className={draftEngine === id ? 'on' : ''}
                  onClick={() => setDraftEngine(id)}
                >
                  <EngineBadge engine={id} bare /> {id === 'codex' ? 'Codex' : 'Claude'}
                  <span className={`dot ${status[id].state}`} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <TranscriptView
            cwd={project}
            transcript={transcript ?? emptyTranscript()}
            approvals={threadApprovals}
            engine={engine}
            onRespond={respond}
          />
        )}

        {error && (
          <div className="error-banner" onClick={() => setError(null)}>
            {error}
          </div>
        )}

        {project && (
          <Composer
            engine={engine}
            engineLocked={!!selected}
            onEngineChange={setDraftEngine}
            models={models[engine] ?? []}
            settings={settings[engine]}
            onSettings={(s) => setSettings((all) => ({ ...all, [engine]: s }))}
            running={running}
            onSend={send}
            onStop={stop}
            centered={!selected}
          />
        )}
      </main>

      {diffOpen && project && <DiffPanel cwd={project} tick={diffTick} onClose={() => setDiffOpen(false)} />}
    </div>
  )
}
