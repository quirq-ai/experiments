import { useCallback, useEffect, useRef, useState } from 'react'
import { createSim, type PresetId, type SessionInfo, type SimHandle, type SimStats } from './engine/sim'
import { PauseIcon, PlayIcon, PlusIcon, ResetIcon } from './components/Icons'
import { Slider } from './components/Slider'

type SceneId = PresetId | 'sessions'

const SCENES: Array<{ id: SceneId; label: string }> = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'trio', label: 'Trio' },
  { id: 'collision', label: 'Collision' },
  { id: 'binary', label: 'Binary' },
  { id: 'cluster', label: 'Cluster' },
  { id: 'solo', label: 'Solo' },
]

const ACTIVE_WINDOW_MS = 90_000
const PROMPTED_TTL_MS = 180_000

function relTime(ts: number) {
  const m = Math.round((Date.now() - ts) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return m + 'm ago'
  const h = Math.round(m / 60)
  if (h < 24) return h + 'h ago'
  const d = Math.round(h / 24)
  if (d < 30) return d + 'd ago'
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function fmtBytes(b: number) {
  if (b < 1024 * 1024) return Math.round(b / 1024) + ' KB'
  return (b / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<SimHandle | null>(null)
  const [paused, setPaused] = useState(false)
  const [scene, setScene] = useState<SceneId>('sessions')
  const [timeScale, setTimeScale] = useState(1)
  const [gravity, setGravity] = useState(1)
  const [trails, setTrails] = useState(0.6)
  const [stats, setStats] = useState<SimStats>({ stars: 0, cores: 0, fps: 0 })
  const [hint, setHint] = useState(true)
  const [selected, setSelected] = useState<SessionInfo | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [promptText, setPromptText] = useState('')
  const [promptStatus, setPromptStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [promptError, setPromptError] = useState('')
  const sceneRef = useRef<SceneId>('sessions')
  const lastListRef = useRef<SessionInfo[]>([])
  const promptedRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    sceneRef.current = scene
  }, [scene])

  const applyActivity = useCallback(() => {
    const now = Date.now()
    const ids = new Set<string>()
    for (const s of lastListRef.current) {
      if (now - s.lastActiveAt < ACTIVE_WINDOW_MS) ids.add(s.id)
    }
    for (const [id, until] of promptedRef.current) {
      if (until > now) ids.add(id)
      else promptedRef.current.delete(id)
    }
    simRef.current?.setActivity([...ids])
  }, [])

  const fetchList = useCallback(async (): Promise<SessionInfo[]> => {
    const res = await fetch('/api/sessions')
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = (await res.json()) as { sessions?: SessionInfo[] }
    const list = data.sessions ?? []
    lastListRef.current = list
    return list
  }, [])

  const loadSessions = useCallback(async () => {
    try {
      const list = await fetchList()
      if (!list.length) throw new Error('no sessions')
      setNotice(null)
      simRef.current?.loadSessions(list)
      applyActivity()
    } catch {
      setNotice('Could not read Claude Code sessions, showing sandbox')
      setScene('trio')
      simRef.current?.loadPreset('trio')
    }
  }, [fetchList, applyActivity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const sim = createSim(canvas, {
      onStats: setStats,
      onThrow: () => setHint(false),
      onSelect: s => {
        setSelected(s)
        if (s) setHint(false)
      },
      startPaused: reduced,
    })
    simRef.current = sim
    if (reduced) setPaused(true)
    void loadSessions()
    return () => {
      sim.destroy()
      simRef.current = null
    }
  }, [loadSessions])

  useEffect(() => {
    if (scene !== 'sessions') return
    const t = window.setInterval(async () => {
      try {
        const list = await fetchList()
        applyActivity()
        setSelected(prev => (prev ? list.find(s => s.id === prev.id) ?? prev : prev))
      } catch {
        return
      }
    }, 4000)
    return () => window.clearInterval(t)
  }, [scene, fetchList, applyActivity])

  useEffect(() => {
    if (!hint) return
    const t = window.setTimeout(() => setHint(false), 14000)
    return () => window.clearTimeout(t)
  }, [hint])

  useEffect(() => {
    setPromptText('')
    setPromptStatus('idle')
    setPromptError('')
  }, [selected?.id])

  const togglePause = useCallback(() => {
    setPaused(p => {
      const next = !p
      simRef.current?.setPaused(next)
      return next
    })
  }, [])

  const resetScene = useCallback(() => {
    setSelected(null)
    simRef.current?.select(null)
    if (sceneRef.current === 'sessions') void loadSessions()
    else simRef.current?.reset()
  }, [loadSessions])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement
      ) {
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        togglePause()
      } else if (e.key === 'r' || e.key === 'R') {
        resetScene()
      } else if ((e.key === 'g' || e.key === 'G') && sceneRef.current !== 'sessions') {
        simRef.current?.addRandomGalaxy()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePause, resetScene])

  const sendPrompt = useCallback(async () => {
    const target = selected
    const text = promptText.trim()
    if (!target || !text || promptStatus === 'sending') return
    setPromptStatus('sending')
    setPromptError('')
    try {
      const res = await fetch('/api/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, prompt: text }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || 'HTTP ' + res.status)
      }
      promptedRef.current.set(target.id, Date.now() + PROMPTED_TTL_MS)
      applyActivity()
      setPromptStatus('sent')
      setPromptText('')
    } catch (err) {
      setPromptStatus('error')
      setPromptError(err instanceof Error ? err.message : String(err))
    }
  }, [selected, promptText, promptStatus, applyActivity])

  const onScene = (id: SceneId) => {
    setScene(id)
    setSelected(null)
    simRef.current?.select(null)
    if (id === 'sessions') void loadSessions()
    else simRef.current?.loadPreset(id)
  }
  const onTime = (v: number) => {
    setTimeScale(v)
    simRef.current?.setTimeScale(v)
  }
  const onGravity = (v: number) => {
    setGravity(v)
    simRef.current?.setGravity(v)
  }
  const onTrails = (v: number) => {
    setTrails(v)
    simRef.current?.setTrails(v)
  }
  const closeCard = () => {
    setSelected(null)
    simRef.current?.select(null)
  }

  const coarse = window.matchMedia('(pointer: coarse)').matches
  const hintText = scene === 'sessions'
    ? 'Each galaxy is a Claude Code session · Click one to inspect or prompt it · Drag to pan · Scroll to zoom'
    : coarse
      ? 'Drag to hurl a galaxy · Pinch to zoom · Two-finger drag to pan'
      : 'Drag to hurl a galaxy · Scroll to zoom · Right-drag to pan · Space to pause'

  return (
    <>
      <canvas ref={canvasRef} className="stage" />
      <div className="vignette" aria-hidden="true" />
      <header className="hud">
        <div className="wordmark">
          galaxy <em>sandbox</em>
        </div>
        <div className="stats">
          {stats.stars.toLocaleString()} stars · {stats.cores} {scene === 'sessions' ? 'sessions' : 'cores'} · {stats.fps} fps
        </div>
      </header>
      {notice && <div className="notice">{notice}</div>}
      {selected && (
        <aside className="card">
          <div className="card-head">
            <span className={selected.isCurrent ? 'card-project current' : 'card-project'}>
              {selected.isCurrent ? 'This session' : selected.project}
            </span>
            <button className="card-close" onClick={closeCard} aria-label="Close session details">
              ×
            </button>
          </div>
          <p className="card-title">{selected.title}</p>
          <dl className="card-meta">
            <div>
              <dt>Messages</dt>
              <dd>{selected.messages.toLocaleString()}</dd>
            </div>
            <div>
              <dt>Transcript</dt>
              <dd>{fmtBytes(selected.bytes)}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{fmtDate(selected.startedAt)}</dd>
            </div>
            <div>
              <dt>Last active</dt>
              <dd>{relTime(selected.lastActiveAt)}</dd>
            </div>
          </dl>
          {selected.isCurrent ? (
            <p className="card-note">This is the live session you are chatting in right now.</p>
          ) : (
            <div className="card-prompt">
              <textarea
                rows={2}
                placeholder="Send a prompt to this session..."
                value={promptText}
                onChange={e => {
                  setPromptText(e.target.value)
                  if (promptStatus !== 'idle') setPromptStatus('idle')
                }}
              />
              <div className="card-prompt-row">
                <button
                  className="btn"
                  onClick={() => void sendPrompt()}
                  disabled={!promptText.trim() || promptStatus === 'sending'}
                >
                  {promptStatus === 'sending' ? 'Sending...' : 'Prompt session'}
                </button>
                {promptStatus === 'sent' && <span className="prompt-ok">Sent. Watch it move.</span>}
                {promptStatus === 'error' && <span className="prompt-err" title={promptError}>{promptError}</span>}
              </div>
            </div>
          )}
        </aside>
      )}
      {hint && <div className="hint">{hintText}</div>}
      <div className="dock">
        <div className="row">
          <button
            className="btn icon"
            onClick={togglePause}
            aria-label={paused ? 'Resume' : 'Pause'}
            title={paused ? 'Resume (Space)' : 'Pause (Space)'}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
          <button className="btn icon" onClick={resetScene} aria-label="Reset scene" title="Reset scene (R)">
            <ResetIcon />
          </button>
          {scene !== 'sessions' && (
            <button className="btn" onClick={() => simRef.current?.addRandomGalaxy()} title="Add galaxy (G)">
              <PlusIcon />
              Galaxy
            </button>
          )}
          <div className="presets" role="group" aria-label="Scenes">
            {SCENES.map(p => (
              <button
                key={p.id}
                className={p.id === scene ? 'preset active' : 'preset'}
                onClick={() => onScene(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <Slider label="Speed" min={0.2} max={2.5} step={0.1} value={timeScale} onChange={onTime} format={v => v.toFixed(1) + 'x'} />
          <Slider label="Gravity" min={0.3} max={2.5} step={0.1} value={gravity} onChange={onGravity} format={v => v.toFixed(1) + 'x'} />
          <Slider label="Trails" min={0} max={1} step={0.05} value={trails} onChange={onTrails} format={v => Math.round(v * 100) + '%'} />
        </div>
      </div>
    </>
  )
}
