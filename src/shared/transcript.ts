// One reducer turns app-server notifications into a transcript. Main uses it to
// persist threads; the renderer uses it to draw them. Engine-agnostic by design.
import type { ThreadItem, Turn, TurnError, TurnStatus } from './protocol'

export interface TurnRecord {
  id: string
  status: TurnStatus
  durationMs: number | null
  error: TurnError | null
  itemIds: string[]
}

export interface Transcript {
  items: Record<string, ThreadItem>
  turns: TurnRecord[]
  activeTurnId: string | null
  errors: { turnId: string; message: string }[]
}

export const emptyTranscript = (): Transcript => ({ items: {}, turns: [], activeTurnId: null, errors: [] })

function turnFor(t: Transcript, turnId: string): TurnRecord {
  let rec = t.turns.find((r) => r.id === turnId)
  if (!rec) {
    rec = { id: turnId, status: 'inProgress', durationMs: null, error: null, itemIds: [] }
    t.turns = [...t.turns, rec]
  }
  return rec
}

/** Returns a new transcript (shallow-copied where changed), or the same one if nothing applies. */
export function applyNotification(prev: Transcript, method: string, params: any): Transcript {
  const t: Transcript = { ...prev, items: prev.items, turns: prev.turns }
  switch (method) {
    case 'turn/started': {
      const turn = params.turn as Turn
      turnFor(t, turn.id)
      t.activeTurnId = turn.id
      return t
    }
    case 'turn/completed': {
      const turn = params.turn as Turn
      const rec = turnFor(t, turn.id)
      t.turns = t.turns.map((r) =>
        r === rec ? { ...r, status: turn.status, durationMs: turn.durationMs, error: turn.error } : r
      )
      if (t.activeTurnId === turn.id) t.activeTurnId = null
      // Anything still marked in progress is finished now.
      const items = { ...t.items }
      for (const id of rec.itemIds) {
        const it = items[id] as any
        if (it?.status === 'inProgress') items[id] = { ...it, status: turn.status === 'interrupted' ? 'declined' : 'failed' }
      }
      t.items = items
      return t
    }
    case 'item/started':
    case 'item/completed': {
      const item = params.item as ThreadItem
      const rec = turnFor(t, params.turnId)
      if (!rec.itemIds.includes(item.id)) {
        t.turns = t.turns.map((r) => (r === rec ? { ...r, itemIds: [...r.itemIds, item.id] } : r))
      }
      // Keep streamed text if the completed item arrives without it.
      const existing = t.items[item.id] as any
      const merged =
        item.type === 'agentMessage' && existing?.text && !item.text ? { ...item, text: existing.text } : item
      t.items = { ...t.items, [item.id]: merged }
      return t
    }
    case 'item/agentMessage/delta':
    case 'item/plan/delta': {
      const it = t.items[params.itemId] as any
      if (!it) return prev
      t.items = { ...t.items, [params.itemId]: { ...it, text: (it.text ?? '') + params.delta } }
      return t
    }
    case 'item/commandExecution/outputDelta': {
      const it = t.items[params.itemId] as any
      if (!it) return prev
      t.items = {
        ...t.items,
        [params.itemId]: { ...it, aggregatedOutput: (it.aggregatedOutput ?? '') + params.delta }
      }
      return t
    }
    case 'item/reasoning/summaryTextDelta': {
      const it = t.items[params.itemId] as any
      if (!it || it.type !== 'reasoning') return prev
      const summary = [...(it.summary ?? [])]
      const idx = params.summaryIndex ?? Math.max(0, summary.length - 1)
      summary[idx] = (summary[idx] ?? '') + params.delta
      t.items = { ...t.items, [params.itemId]: { ...it, summary } }
      return t
    }
    case 'error': {
      if (params.willRetry) return prev
      t.errors = [...t.errors, { turnId: params.turnId, message: params.error?.message ?? 'Unknown error' }]
      return t
    }
    default:
      return prev
  }
}
