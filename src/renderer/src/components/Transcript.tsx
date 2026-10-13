import { useEffect, useRef, useState, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ApprovalDecision, ThreadItem } from '../../../shared/protocol'
import type { Transcript, TurnRecord } from '../../../shared/transcript'
import type { ApprovalRequest, EngineId } from '../../../shared/types'
import { PatchView } from './DiffPanel'

interface Props {
  cwd: string
  transcript: Transcript
  approvals: ApprovalRequest[]
  engine: EngineId
  onRespond(r: ApprovalRequest, d: ApprovalDecision): void
}

export function TranscriptView({ cwd, transcript, approvals, engine, onRespond }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)

  useEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  })

  // Approvals render under their item when it is in the transcript, else at the end.
  const approvalFor = (itemId: string) =>
    approvals
      .filter((a) => a.itemId === itemId)
      .map((r) => <ApprovalCard key={r.requestKey} request={r} engine={engine} onRespond={onRespond} />)
  const unplaced = approvals.filter((a) => !transcript.items[a.itemId])

  return (
    <div
      className="transcript"
      ref={scroller}
      onScroll={(e) => {
        const el = e.currentTarget
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      }}
    >
      <div className="transcript-inner">
        {transcript.turns.map((turn) => (
          <TurnView
            key={turn.id}
            turn={turn}
            transcript={transcript}
            active={transcript.activeTurnId === turn.id}
            approvalFor={approvalFor}
            cwd={cwd}
          />
        ))}
        {unplaced.map((r) => (
            <ApprovalCard key={r.requestKey} request={r} engine={engine} onRespond={onRespond} />
          ))}
      </div>
    </div>
  )
}

function TurnView({
  turn,
  transcript,
  active,
  approvalFor,
  cwd
}: {
  cwd: string
  turn: TurnRecord
  transcript: Transcript
  active: boolean
  approvalFor(itemId: string): ReactNode
}) {
  const items = turn.itemIds.map((id) => transcript.items[id]).filter(Boolean)
  const errors = transcript.errors.filter((e) => e.turnId === turn.id)
  const lastAgent = [...items].reverse().find((i) => i.type === 'agentMessage')
  const showThinking = active && !items.some((i) => (i as any).status === 'inProgress' || i === lastAgent)

  return (
    <section className="turn">
      {items.map((item) => (
        <div key={item.id}>
          <ItemView item={item} streaming={active && item === lastAgent} cwd={cwd} />
          {approvalFor(item.id)}
        </div>
      ))}
      {showThinking && (
        <div className="thinking">
          <span className="shimmer">Thinking</span>
        </div>
      )}
      {errors.map((e, i) => (
        <div key={i} className="turn-error">
          {e.message}
        </div>
      ))}
      {!active && turn.status !== 'inProgress' && (
        <div className="turn-foot">
          {turn.status === 'interrupted'
            ? 'Stopped'
            : turn.status === 'failed'
              ? (turn.error?.message ?? 'Turn failed')
              : turn.durationMs != null
                ? `Worked for ${fmtDuration(turn.durationMs)}`
                : null}
        </div>
      )}
    </section>
  )
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function ItemView({ item, streaming, cwd }: { item: ThreadItem; streaming: boolean; cwd: string }) {
  switch (item.type) {
    case 'userMessage':
      return <div className="user-msg">{item.content.map((c) => c.text).join('\n')}</div>
    case 'agentMessage':
      return (
        <div className={`agent-msg md ${streaming ? 'streaming' : ''}`}>
          <Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown>
        </div>
      )
    case 'reasoning': {
      const text = [...(item.summary ?? []), ...(item.content ?? [])].join('\n\n').trim()
      if (!text) return null
      return (
        <Expandable label={<span className="muted">Thought</span>}>
          <div className="md muted">
            <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
          </div>
        </Expandable>
      )
    }
    case 'plan':
      return (
        <div className="plan md">
          <Markdown remarkPlugins={[remarkGfm]}>{item.text}</Markdown>
        </div>
      )
    case 'commandExecution':
      return (
        <Expandable
          status={item.status}
          label={
            <>
              <span className="verb">{item.status === 'inProgress' ? 'Running' : item.status === 'declined' ? 'Declined' : 'Ran'}</span>
              <code className="cmd">{unwrapShell(item.command)}</code>
              {item.exitCode != null && item.exitCode !== 0 && <span className="pill err">exit {item.exitCode}</span>}
            </>
          }
        >
          <pre className="output">{item.aggregatedOutput || (item.status === 'inProgress' ? '…' : '(no output)')}</pre>
        </Expandable>
      )
    case 'fileChange':
      return (
        <>
          {item.changes.map((c, i) => {
            const adds = c.diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
            const dels = c.diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length
            const verb =
              item.status === 'declined'
                ? 'Declined edit to'
                : c.kind.type === 'add'
                  ? 'Created'
                  : c.kind.type === 'delete'
                    ? 'Deleted'
                    : item.status === 'inProgress'
                      ? 'Editing'
                      : 'Edited'
            return (
              <Expandable
                key={i}
                status={item.status}
                label={
                  <>
                    <span className="verb">{verb}</span>
                    <code className="path">{rel(c.path, cwd)}</code>
                    <span className="adds">+{adds}</span>
                    <span className="dels">−{dels}</span>
                  </>
                }
              >
                <PatchView patch={c.diff} />
              </Expandable>
            )
          })}
        </>
      )
    case 'mcpToolCall':
      return (
        <Expandable
          status={item.status}
          label={
            <>
              <span className="verb">Called</span>
              <code>
                {item.server}.{item.tool}
              </code>
            </>
          }
        >
          <pre className="output">{JSON.stringify(item.arguments, null, 2)}</pre>
          {item.error && <pre className="output err">{item.error.message}</pre>}
        </Expandable>
      )
    case 'dynamicToolCall':
      return (
        <Expandable
          status={item.status}
          label={
            <>
              <span className="verb">{item.tool}</span>
              <span className="muted ellipsis">{rel(summarize(item.arguments), cwd)}</span>
            </>
          }
        >
          <pre className="output">
            {item.contentItems?.map((c) => c.text).join('\n') || JSON.stringify(item.arguments, null, 2)}
          </pre>
        </Expandable>
      )
    case 'webSearch':
      return (
        <div className="tool-row">
          <span className="verb">Searched the web</span>
          <span className="muted">{item.query}</span>
        </div>
      )
    case 'contextCompaction':
      return <div className="divider">Context compacted</div>
    default:
      return null
  }
}

/** Show paths relative to the project, as both engines may report absolute ones. */
function rel(path: string, cwd: string): string {
  const base = cwd.endsWith('/') ? cwd : cwd + '/'
  return path.split(base).join('')
}

/** Codex runs commands as `/bin/zsh -lc "<cmd>"`; show just the command. */
function unwrapShell(cmd: string): string {
  const m = cmd.match(/^\/bin\/(?:ba|z)?sh -lc (['"])([\s\S]*)\1$/)
  return m ? m[2] : cmd
}

function summarize(args: unknown): string {
  if (!args || typeof args !== 'object') return ''
  const a = args as Record<string, unknown>
  for (const k of ['file_path', 'path', 'pattern', 'url', 'query', 'description', 'command', 'prompt']) {
    if (typeof a[k] === 'string') return a[k] as string
  }
  return ''
}

function Expandable({ label, status, children }: { label: ReactNode; status?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`tool ${status ?? ''} ${open ? 'open' : ''}`}>
      <button className="tool-row" onClick={() => setOpen((o) => !o)}>
        <span className={`tool-state ${status ?? ''}`} />
        {label}
        <span className="chev">›</span>
      </button>
      {open && <div className="tool-body">{children}</div>}
    </div>
  )
}

function ApprovalCard({
  request,
  engine,
  onRespond
}: {
  request: ApprovalRequest
  engine: EngineId
  onRespond(r: ApprovalRequest, d: ApprovalDecision): void
}) {
  const who = engine === 'codex' ? 'Codex' : 'Claude'
  const isEdit = request.method === 'item/fileChange/requestApproval'
  return (
    <div className="approval">
      <div className="approval-title">{isEdit ? `Allow ${who} to edit files?` : `Allow ${who} to run this?`}</div>
      {request.command && <pre className="approval-cmd">{request.command}</pre>}
      {request.reason && <div className="approval-reason">{request.reason}</div>}
      <div className="approval-actions">
        <button className="ghost-btn" autoFocus onClick={() => onRespond(request, 'decline')}>
          Decline
        </button>
        <button className="ghost-btn" onClick={() => onRespond(request, 'acceptForSession')}>
          Allow for this session
        </button>
        <button className="primary-btn" onClick={() => onRespond(request, 'accept')}>
          Allow
        </button>
      </div>
    </div>
  )
}
