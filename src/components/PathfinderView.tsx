import { useMemo, useState } from 'react'
import { findShortestPath, type GraphIndex } from '../lib/graph'
import { domainColor, domainLabel, edgeColor } from '../lib/palette'
import type { TechnologyNode } from '../types'
import { Icon } from './Icon'

interface PathfinderViewProps {
  graphIndex: GraphIndex
  nodes: readonly TechnologyNode[]
  onSelectNode: (node: TechnologyNode) => void
  onTracePath: (nodeIds: string[]) => void
}

function findAnchor(nodes: readonly TechnologyNode[], terms: string[], fallback: TechnologyNode) {
  for (const term of terms) {
    const match = nodes.find((node) => node.title.toLowerCase().includes(term))
    if (match) return match
  }
  return fallback
}

export function PathfinderView({ graphIndex, nodes, onSelectNode, onTracePath }: PathfinderViewProps) {
  const chronological = useMemo(() => [...nodes].sort((a, b) => a.year - b.year), [nodes])
  const earliest = chronological[0]
  const latest = chronological.at(-1) ?? chronological[0]
  const defaultFrom = findAnchor(nodes, ['stone tool', 'knapped'], earliest)
  const defaultTo = findAnchor(nodes, ['foundation and generative', 'generative ai', 'foundation model', 'transformer'], latest)
  const [fromId, setFromId] = useState(defaultFrom?.id ?? '')
  const [toId, setToId] = useState(defaultTo?.id ?? '')
  const [fromText, setFromText] = useState(defaultFrom?.title ?? '')
  const [toText, setToText] = useState(defaultTo?.title ?? '')
  const [resolvedPair, setResolvedPair] = useState<[string, string]>([defaultFrom?.id ?? '', defaultTo?.id ?? ''])
  const [pathMode, setPathMode] = useState<'causal' | 'association'>('causal')
  const direction = pathMode === 'causal' ? 'outgoing' : 'both'

  const path = useMemo(
    () => findShortestPath(graphIndex, resolvedPair[0], resolvedPair[1], { direction }),
    [direction, graphIndex, resolvedPair],
  )

  const syncValue = (value: string, setter: (id: string) => void) => {
    const match = nodes.find((node) => node.title.toLowerCase() === value.trim().toLowerCase())
    setter(match?.id ?? '')
  }

  const swap = () => {
    setFromId(toId)
    setToId(fromId)
    setFromText(toText)
    setToText(fromText)
    setResolvedPair([toId, fromId])
  }

  const surprise = () => {
    if (nodes.length < 2) return
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const source = nodes[Math.floor(Math.random() * nodes.length)]
      const target = nodes[Math.floor(Math.random() * nodes.length)]
      if (source.id === target.id) continue
      const candidate = findShortestPath(graphIndex, source.id, target.id, { direction })
      if (candidate && candidate.nodes.length >= 4 && candidate.nodes.length <= 8) {
        setFromId(source.id)
        setToId(target.id)
        setFromText(source.title)
        setToText(target.title)
        setResolvedPair([source.id, target.id])
        return
      }
    }
  }

  return (
    <section className="pathfinder-view" aria-labelledby="pathfinder-title">
      <div className="view-intro pathfinder-intro">
        <div>
          <span className="eyebrow">Causal pathfinder</span>
          <h1 id="pathfinder-title">How did we get from there to here?</h1>
          <p>Choose any two breakthroughs. We’ll find the shortest documented chain across domains and centuries.</p>
        </div>
        <div className="path-mode-toggle" role="group" aria-label="Connection direction">
          <button aria-pressed={pathMode === 'causal'} className={pathMode === 'causal' ? 'is-active' : ''} onClick={() => setPathMode('causal')} type="button">Causal · forward</button>
          <button aria-pressed={pathMode === 'association'} className={pathMode === 'association' ? 'is-active' : ''} onClick={() => setPathMode('association')} type="button">Any connection</button>
        </div>
      </div>

      <div aria-label="Choose technologies to connect" className="path-controls" role="group">
        <label className="path-field path-field-from">
          <span>From</span>
          <input
            aria-label="Starting technology"
            list="path-from-options"
            onBlur={() => syncValue(fromText, setFromId)}
            onChange={(event) => {
              setFromText(event.target.value)
              syncValue(event.target.value, setFromId)
            }}
            value={fromText}
          />
          <datalist id="path-from-options">{nodes.map((node) => <option key={node.id} value={node.title}>{node.yearLabel}</option>)}</datalist>
        </label>
        <button aria-label="Swap starting and ending technologies" className="swap-button" onClick={swap} type="button"><Icon name="swap" size={17} /></button>
        <label className="path-field path-field-to">
          <span>To</span>
          <input
            aria-label="Ending technology"
            list="path-to-options"
            onBlur={() => syncValue(toText, setToId)}
            onChange={(event) => {
              setToText(event.target.value)
              syncValue(event.target.value, setToId)
            }}
            value={toText}
          />
          <datalist id="path-to-options">{nodes.map((node) => <option key={node.id} value={node.title}>{node.yearLabel}</option>)}</datalist>
        </label>
        <button className="primary-button connect-button" disabled={!fromId || !toId || fromId === toId} onClick={() => setResolvedPair([fromId, toId])} type="button">
          Connect <Icon name="route" size={15} />
        </button>
        <button className="secondary-button surprise-button" onClick={surprise} type="button"><Icon name="shuffle" size={15} /> Surprise me</button>
      </div>

      {path ? (
        <div className="path-result">
          <div className="path-summary">
            <div>
              <strong>{Math.max(0, path.nodes.length - 1)}</strong>
              <span>{pathMode === 'causal' ? 'forward steps through history' : 'degrees of technological separation'}</span>
            </div>
            <p><b>{path.nodes[0]?.title}</b> to <b>{path.nodes.at(-1)?.title}</b> across {new Set(path.nodes.map((node) => node.domain)).size} domains.</p>
            <button className="secondary-button" onClick={() => onTracePath(path.nodeIds)} type="button"><Icon name="network" size={15} /> Trace on graph</button>
          </div>

          <ol className="path-chain">
            {path.nodes.map((node, index) => {
              const edge = path.edges[index]
              const forward = edge?.source === node.id
              return (
                <li key={node.id}>
                  <button className="path-node-card" onClick={() => onSelectNode(node)} type="button">
                    <span className="path-step">{String(index + 1).padStart(2, '0')}</span>
                    <span className="path-node-dot" style={{ background: domainColor(node.domain) }} />
                    <span className="path-node-copy">
                      <small>{domainLabel(node.domain)}</small>
                      <strong>{node.title}</strong>
                      <span>{node.yearLabel} · {node.location}</span>
                    </span>
                    <span className="impact-dots" aria-label={`Impact ${node.impact} out of 5`}>
                      {Array.from({ length: 5 }, (_, dot) => <i className={dot < node.impact ? 'is-filled' : ''} key={dot} />)}
                    </span>
                  </button>
                  {edge ? (
                    <div className="path-edge" style={{ '--edge-color': edgeColor(edge.type) } as React.CSSProperties}>
                      <span className="path-edge-line"><i /></span>
                      <div>
                        <strong>{forward ? edge.label : `Connected by ${edge.label.toLowerCase()}`}</strong>
                        <p>{edge.description}</p>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </div>
      ) : (
        <div className="empty-path">
          <Icon name="route" size={28} />
          <h2>No documented path in this slice</h2>
          <p>{pathMode === 'causal' ? 'No forward chain is documented. Try swapping the endpoints or use Any connection.' : 'Try choosing another pair.'}</p>
        </div>
      )}
    </section>
  )
}
