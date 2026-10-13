import type { EngineId } from '../../../shared/types'

export function EngineBadge({ engine, bare }: { engine: EngineId; bare?: boolean }) {
  const label = engine === 'codex' ? 'Codex' : 'Claude'
  if (bare) return <span className={`engine-mark ${engine}`} aria-hidden />
  return (
    <span className={`engine-badge ${engine}`} title={`Running on ${label}`}>
      <span className={`engine-mark ${engine}`} aria-hidden />
      {label}
    </span>
  )
}
