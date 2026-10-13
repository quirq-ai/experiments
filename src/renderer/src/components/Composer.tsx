import { useEffect, useRef, useState } from 'react'
import type { Model, ReasoningEffort } from '../../../shared/protocol'
import { ACCESS, type Access, type EngineId, type TurnSettings } from '../../../shared/types'
import { EngineBadge } from './EngineBadge'

interface Props {
  engine: EngineId
  engineLocked: boolean
  onEngineChange(e: EngineId): void
  models: Model[]
  settings: TurnSettings
  onSettings(s: TurnSettings): void
  running: boolean
  onSend(text: string): void
  onStop(): void
  centered: boolean
}

export function Composer(p: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)
  const model = p.models.find((m) => m.id === p.settings.model)
  const efforts = model?.supportedReasoningEfforts ?? []
  const effort = p.settings.effort ?? model?.defaultReasoningEffort ?? null

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 280) + 'px'
  }, [text])

  useEffect(() => ref.current?.focus(), [p.engineLocked])

  const submit = () => {
    const t = text.trim()
    if (!t || p.running) return
    p.onSend(t)
    setText('')
  }

  return (
    <div className={`composer-wrap ${p.centered ? 'centered' : ''}`}>
      <div className="composer">
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder={p.running ? 'Working…' : 'Ask for a change, a fix, or an explanation'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
        />
        <div className="composer-bar">
          <label className={`chip ${p.engineLocked ? 'locked' : ''}`} title="Engine (app-server)">
            <EngineBadge engine={p.engine} bare />
            <select
              value={p.engine}
              disabled={p.engineLocked}
              onChange={(e) => p.onEngineChange(e.target.value as EngineId)}
            >
              <option value="codex">Codex</option>
              <option value="claude">Claude</option>
            </select>
          </label>

          <label className="chip" title="Model">
            <select
              value={p.settings.model}
              onChange={(e) => p.onSettings({ ...p.settings, model: e.target.value, effort: null })}
            >
              {p.models.length === 0 && <option value={p.settings.model}>Loading…</option>}
              {p.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName}
                </option>
              ))}
            </select>
          </label>

          {efforts.length > 0 && (
            <label className="chip" title="Reasoning effort">
              <select
                value={effort ?? ''}
                onChange={(e) => p.onSettings({ ...p.settings, effort: e.target.value as ReasoningEffort })}
              >
                {efforts.map((e) => (
                  <option key={e.reasoningEffort} value={e.reasoningEffort} title={e.description}>
                    {e.reasoningEffort}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={`chip access-${p.settings.access}`} title={ACCESS.find((a) => a.id === p.settings.access)?.hint}>
            <select
              value={p.settings.access}
              onChange={(e) => p.onSettings({ ...p.settings, access: e.target.value as Access })}
            >
              {ACCESS.map((a) => (
                <option key={a.id} value={a.id} title={a.hint}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <span className="spacer" />
          {p.running ? (
            <button className="send stop" onClick={p.onStop} title="Stop">
              ■
            </button>
          ) : (
            <button className="send" onClick={submit} disabled={!text.trim()} title="Send (Enter)">
              ↑
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
