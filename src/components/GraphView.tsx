import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import { useElementSize } from '../hooks/useElementSize'
import { edgeColor, domainColor, domainLabel } from '../lib/palette'
import { seededUnit, timeTicks, yearPosition } from '../lib/time'
import type { TechnologyEdge, TechnologyNode } from '../types'
import { Icon } from './Icon'

export type GraphLayout = 'constellation' | 'chronology'

interface GraphViewProps {
  edges: readonly TechnologyEdge[]
  focusDepth: 1 | 2
  focusId: string | null
  highlightedPath: readonly string[]
  layout: GraphLayout
  nodes: readonly TechnologyNode[]
  selectedId: string | null
  onChangeFocusDepth: (depth: 1 | 2) => void
  onChangeLayout: (layout: GraphLayout) => void
  onClearFocus: () => void
  onSelectNode: (node: TechnologyNode, focus: boolean) => void
}

interface Position { x: number; y: number }
interface Viewport { x: number; y: number; k: number }

const EMPTY_PATH: readonly string[] = []

const visuallyHiddenStyle: React.CSSProperties = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  margin: -1,
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: 1,
}

const nodeRadius = (node: TechnologyNode) => 2.5 + node.impact * 1.15

function computePositions(nodes: readonly TechnologyNode[], edges: readonly TechnologyEdge[], width: number, height: number, layout: GraphLayout) {
  const positions = new Map<string, Position>()
  const domains = [...new Set(nodes.map((node) => node.domain))].sort()

  if (layout === 'chronology') {
    const usableWidth = Math.max(400, width - 130)
    const usableHeight = Math.max(260, height - 120)
    nodes.forEach((node) => {
      const lane = domains.indexOf(node.domain)
      const baseY = 75 + (lane + 0.5) * (usableHeight / Math.max(domains.length, 1))
      positions.set(node.id, {
        x: 85 + yearPosition(node.year) * usableWidth,
        y: baseY + (seededUnit(`${node.id}-y`) - 0.5) * Math.min(28, usableHeight / domains.length * 0.55),
      })
    })
    return positions
  }

  const centerX = width / 2
  const centerY = height / 2
  const domainCenters = new Map(domains.map((domain, index) => {
    const angle = index * 2.3999632297 - Math.PI / 2
    const radius = Math.sqrt((index + 1) / Math.max(1, domains.length))
    return [domain, {
      x: centerX + Math.cos(angle) * width * 0.31 * radius,
      y: centerY + Math.sin(angle) * height * 0.29 * radius,
    }]
  }))
  const simulated = nodes.map((node) => {
    const center = domainCenters.get(node.domain) ?? { x: centerX, y: centerY }
    const angle = seededUnit(`${node.id}-a`) * Math.PI * 2
    const radius = 18 + seededUnit(`${node.id}-r`) * 72
    return { node, x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius, vx: 0, vy: 0 }
  })
  const indexById = new Map(simulated.map((item, index) => [item.node.id, index]))
  const springs = edges.flatMap((edge) => {
    const source = indexById.get(edge.source)
    const target = indexById.get(edge.target)
    return source === undefined || target === undefined ? [] : [{ source, target }]
  })

  for (let iteration = 0; iteration < 150; iteration += 1) {
    const cooling = 1 - iteration / 175
    for (let first = 0; first < simulated.length; first += 1) {
      const a = simulated[first]
      for (let second = first + 1; second < simulated.length; second += 1) {
        const b = simulated[second]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distanceSquared = Math.max(64, dx * dx + dy * dy)
        const distance = Math.sqrt(distanceSquared)
        const force = 1450 / distanceSquared * cooling
        const fx = dx / distance * force
        const fy = dy / distance * force
        a.vx -= fx
        a.vy -= fy
        b.vx += fx
        b.vy += fy
      }
    }
    for (const spring of springs) {
      const source = simulated[spring.source]
      const target = simulated[spring.target]
      const dx = target.x - source.x
      const dy = target.y - source.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const force = (distance - 78) * 0.006 * cooling
      const fx = dx / distance * force
      const fy = dy / distance * force
      source.vx += fx
      source.vy += fy
      target.vx -= fx
      target.vy -= fy
    }
    for (const item of simulated) {
      const domainCenter = domainCenters.get(item.node.domain) ?? { x: centerX, y: centerY }
      item.vx += (domainCenter.x - item.x) * 0.0035 * cooling + (centerX - item.x) * 0.0008
      item.vy += (domainCenter.y - item.y) * 0.0035 * cooling + (centerY - item.y) * 0.0008
      item.vx *= 0.78
      item.vy *= 0.78
      item.x = Math.max(28, Math.min(width - 28, item.x + item.vx))
      item.y = Math.max(52, Math.min(height - 36, item.y + item.vy))
    }
  }

  const minX = Math.min(...simulated.map((item) => item.x))
  const maxX = Math.max(...simulated.map((item) => item.x))
  const minY = Math.min(...simulated.map((item) => item.y))
  const maxY = Math.max(...simulated.map((item) => item.y))
  const horizontalPadding = Math.max(45, width * 0.055)
  const verticalPadding = 48
  simulated.forEach((item) => positions.set(item.node.id, {
    x: horizontalPadding + (item.x - minX) / Math.max(1, maxX - minX) * (width - horizontalPadding * 2),
    y: verticalPadding + (item.y - minY) / Math.max(1, maxY - minY) * (height - verticalPadding - 34),
  }))
  return positions
}

function neighborhood(nodes: readonly TechnologyNode[], edges: readonly TechnologyEdge[], focusId: string | null, depth: 1 | 2) {
  if (!focusId) return new Set(nodes.map((node) => node.id))
  const allowed = new Set(nodes.map((node) => node.id))
  const adjacency = new Map<string, Set<string>>()
  for (const edge of edges) {
    if (!allowed.has(edge.source) || !allowed.has(edge.target)) continue
    if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set())
    if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set())
    adjacency.get(edge.source)!.add(edge.target)
    adjacency.get(edge.target)!.add(edge.source)
  }
  const found = new Set([focusId])
  let frontier = [focusId]
  for (let hop = 0; hop < depth; hop += 1) {
    const next: string[] = []
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? EMPTY_PATH) {
        if (!found.has(neighbor)) {
          found.add(neighbor)
          next.push(neighbor)
        }
      }
    }
    frontier = next
  }
  return found
}

const GraphNode = memo(function GraphNode({
  active,
  labelOnLeft,
  node,
  position,
  selected,
  showLabel,
  onDoubleClick,
  onKeyDown,
  onPointerDown,
  onSelect,
}: {
  active: boolean
  labelOnLeft: boolean
  node: TechnologyNode
  position: Position
  selected: boolean
  showLabel: boolean
  onDoubleClick: () => void
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => void
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void
  onSelect: () => void
}) {
  const radius = nodeRadius(node)
  const color = domainColor(node.domain)
  const clickTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current)
  }, [])

  const queueSelect = () => {
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current)
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null
      onSelect()
    }, 180)
  }

  const expandImmediately = () => {
    if (clickTimerRef.current !== null) window.clearTimeout(clickTimerRef.current)
    clickTimerRef.current = null
    onDoubleClick()
  }

  return (
    <g
      aria-label={`${node.title}, ${node.yearLabel}, ${domainLabel(node.domain)}`}
      aria-current={selected ? 'true' : undefined}
      className={`graph-node${active ? ' is-active' : ' is-muted'}${selected ? ' is-selected' : ''}`}
      onClick={queueSelect}
      onDoubleClick={expandImmediately}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      role="button"
      style={{ '--node-color': color } as React.CSSProperties}
      tabIndex={0}
      transform={`translate(${position.x.toFixed(1)} ${position.y.toFixed(1)})`}
    >
      {selected ? <circle className="node-pulse" r={radius + 8} /> : null}
      <circle className="node-hit" r={Math.max(12, radius + 5)} />
      <circle className="node-core" r={radius} />
      <text
        className={showLabel ? 'node-label is-visible' : 'node-label'}
        dominantBaseline="central"
        textAnchor={labelOnLeft ? 'end' : 'start'}
        x={labelOnLeft ? -(radius + 7) : radius + 7}
        y="0"
      >
        {node.title}
      </text>
      <title>{node.title} · {node.yearLabel}\n{node.summary}</title>
    </g>
  )
})

export function GraphView({
  edges,
  focusDepth,
  focusId,
  highlightedPath,
  layout,
  nodes,
  selectedId,
  onChangeFocusDepth,
  onChangeLayout,
  onClearFocus,
  onSelectNode,
}: GraphViewProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>()
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, k: 1 })
  const [positionOverrides, setPositionOverrides] = useState<Map<string, Position>>(() => new Map())
  const pointerRef = useRef<
    | { mode: 'pan'; x: number; y: number; viewport: Viewport }
    | { mode: 'node'; id: string; moved: boolean; startX: number; startY: number }
    | null
  >(null)
  const suppressClickRef = useRef(false)
  const lastCenteredKeyRef = useRef<string | null>(null)

  const basePositions = useMemo(() => computePositions(nodes, edges, width, height, layout), [edges, height, layout, nodes, width])
  const positions = useMemo(() => {
    if (!positionOverrides.size) return basePositions
    const merged = new Map(basePositions)
    for (const [id, position] of positionOverrides) if (merged.has(id)) merged.set(id, position)
    return merged
  }, [basePositions, positionOverrides])
  const visibleIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes])
  const focusIds = useMemo(() => neighborhood(nodes, edges, focusId, focusDepth), [edges, focusDepth, focusId, nodes])
  const pathIds = useMemo(() => new Set(highlightedPath), [highlightedPath])
  const pathPairs = useMemo(() => {
    const pairs = new Set<string>()
    for (let index = 0; index < highlightedPath.length - 1; index += 1) {
      pairs.add([highlightedPath[index], highlightedPath[index + 1]].sort().join('|'))
    }
    return pairs
  }, [highlightedPath])
  const renderedEdges = useMemo(
    () => edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target) && positions.has(edge.source) && positions.has(edge.target)),
    [edges, positions, visibleIds],
  )
  const domains = useMemo(() => [...new Set(nodes.map((node) => node.domain))].sort(), [nodes])

  useEffect(() => {
    setViewport({ x: 0, y: 0, k: 1 })
    setPositionOverrides(new Map())
  }, [layout])

  useEffect(() => {
    if (!focusId) {
      lastCenteredKeyRef.current = null
      return
    }
    const key = `${layout}:${focusId}`
    if (lastCenteredKeyRef.current === key) return
    const position = basePositions.get(focusId)
    if (!position) return
    lastCenteredKeyRef.current = key
    setViewport({ x: width * 0.43 - position.x, y: height * 0.5 - position.y, k: 1 })
  }, [basePositions, focusId, height, layout, width])

  const zoom = (factor: number) => {
    setViewport((current) => ({ ...current, k: Math.max(0.45, Math.min(3.6, current.k * factor)) }))
  }

  const resetView = () => {
    setViewport({ x: 0, y: 0, k: 1 })
    setPositionOverrides(new Map())
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top
    const factor = event.deltaY > 0 ? 0.9 : 1.1
    setViewport((current) => {
      const nextK = Math.max(0.45, Math.min(3.6, current.k * factor))
      const ratio = nextK / current.k
      return {
        k: nextK,
        x: mouseX - (mouseX - current.x) * ratio,
        y: mouseY - (mouseY - current.y) * ratio,
      }
    })
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const pointer = pointerRef.current
    if (!pointer) return
    if (pointer.mode === 'pan') {
      setViewport({
        ...pointer.viewport,
        x: pointer.viewport.x + event.clientX - pointer.x,
        y: pointer.viewport.y + event.clientY - pointer.y,
      })
      return
    }
    if (!pointer.moved && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 4) return
    pointer.moved = true
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left - viewport.x) / viewport.k
    const y = (event.clientY - rect.top - viewport.y) / viewport.k
    setPositionOverrides((current) => {
      const next = new Map(current)
      next.set(pointer.id, { x, y })
      return next
    })
  }

  const releasePointer = () => {
    const pointer = pointerRef.current
    if (pointer?.mode === 'node' && pointer.moved) suppressClickRef.current = true
    pointerRef.current = null
  }
  const cancelPointer = () => { pointerRef.current = null }

  return (
    <section aria-describedby="graph-description" aria-labelledby="graph-title" className="graph-stage" ref={ref}>
      <h1 id="graph-title" style={visuallyHiddenStyle}>Historical technology knowledge graph</h1>
      <p id="graph-description" style={visuallyHiddenStyle}>Explore relationships between technological breakthroughs. Select a node to inspect it, or expand its surrounding connections.</p>
      <div className="graph-overlay graph-instructions">
        <span className="eyebrow">Explore the dependency web</span>
        <p>Click to inspect · double-click to expand · drag nodes · scroll to zoom</p>
      </div>

      <div className="graph-overlay graph-layout-toggle" role="group" aria-label="Graph layout">
        <button aria-pressed={layout === 'constellation'} className={layout === 'constellation' ? 'is-active' : ''} onClick={() => onChangeLayout('constellation')} type="button">
          <Icon name="network" size={14} /> Constellation
        </button>
        <button aria-pressed={layout === 'chronology'} className={layout === 'chronology' ? 'is-active' : ''} onClick={() => onChangeLayout('chronology')} type="button">
          <Icon name="timeline" size={14} /> Chronology
        </button>
      </div>

      <svg
        aria-label={`Knowledge graph with ${nodes.length} technology nodes and ${renderedEdges.length} visible relationships`}
        className="knowledge-graph"
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return
          event.currentTarget.setPointerCapture(event.pointerId)
          pointerRef.current = { mode: 'pan', x: event.clientX, y: event.clientY, viewport }
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={cancelPointer}
        onWheel={handleWheel}
        role="group"
        viewBox={`0 0 ${width} ${height}`}
      >
        <defs>
          <filter id="node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <marker id="edge-arrow" markerHeight="5" markerWidth="6" orient="auto" refX="13" refY="2.5">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
          </marker>
        </defs>
        <g transform={`translate(${viewport.x.toFixed(1)} ${viewport.y.toFixed(1)}) scale(${viewport.k.toFixed(3)})`}>
          {layout === 'chronology' ? (
            <g className="graph-axis" aria-hidden="true">
              {timeTicks.map((tick) => {
                const x = 85 + yearPosition(tick.year) * Math.max(400, width - 130)
                return <g key={tick.year} transform={`translate(${x} 0)`}><line y1="48" y2={height - 32} /><text y="34" textAnchor="middle">{tick.label}</text></g>
              })}
              {domains.map((domain, index) => {
                const usableHeight = Math.max(260, height - 120)
                const y = 75 + (index + 0.5) * (usableHeight / Math.max(domains.length, 1))
                return <text className="lane-label" key={domain} x="12" y={y}>{domainLabel(domain)}</text>
              })}
            </g>
          ) : null}

          <g aria-hidden="true" className="graph-edges">
            {renderedEdges.map((edge, index) => {
              const source = positions.get(edge.source)!
              const target = positions.get(edge.target)!
              const pairKey = [edge.source, edge.target].sort().join('|')
              const inPath = pathPairs.has(pairKey)
              const active = inPath || Boolean(focusId && focusIds.has(edge.source) && focusIds.has(edge.target))
              return (
                <line
                  className={`${active ? 'is-active' : 'is-muted'}${inPath ? ' is-path' : ''}`}
                  key={`${edge.source}-${edge.target}-${index}`}
                  markerEnd={active ? 'url(#edge-arrow)' : undefined}
                  style={{ '--edge-color': inPath ? 'var(--accent)' : edgeColor(edge.type) } as React.CSSProperties}
                  x1={source.x}
                  x2={target.x}
                  y1={source.y}
                  y2={target.y}
                />
              )
            })}
          </g>

          <g className="graph-nodes">
            {nodes.map((node) => {
              const active = focusIds.has(node.id) || pathIds.has(node.id)
              const position = positions.get(node.id)!
              const screenX = viewport.x + position.x * viewport.k
              const estimatedLabelWidth = (nodeRadius(node) + 7 + Math.min(190, Math.max(58, node.title.length * 5.2))) * viewport.k
              const rightSpace = width - screenX
              const labelOnLeft = rightSpace < estimatedLabelWidth && screenX > rightSpace
              return (
                <GraphNode
                  active={active}
                  key={node.id}
                  labelOnLeft={labelOnLeft}
                  node={node}
                  onDoubleClick={() => {
                    onSelectNode(node, true)
                    onChangeFocusDepth(2)
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectNode(node, true)
                    }
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    pointerRef.current = { mode: 'node', id: node.id, moved: false, startX: event.clientX, startY: event.clientY }
                  }}
                  onSelect={() => {
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    onSelectNode(node, true)
                  }}
                  position={position}
                  selected={selectedId === node.id}
                  showLabel={selectedId === node.id || pathIds.has(node.id) || (focusId ? active : width > 600 && node.impact === 5 && seededUnit(`${node.id}-label`) > (layout === 'chronology' ? 0.9 : 0.82))}
                />
              )
            })}
          </g>
        </g>
      </svg>

      <div className="graph-overlay graph-zoom" aria-label="Graph controls">
        <button aria-label="Zoom in" onClick={() => zoom(1.2)} type="button"><Icon name="zoom-in" size={16} /></button>
        <button aria-label="Zoom out" onClick={() => zoom(0.83)} type="button"><Icon name="zoom-out" size={16} /></button>
        <button aria-label="Reset graph view" onClick={resetView} type="button"><Icon name="center" size={16} /></button>
      </div>

      <div className="graph-overlay graph-status">
        {focusId ? (
          <>
            <span><strong>{focusIds.size}</strong> nodes · {focusDepth} {focusDepth === 1 ? 'hop' : 'hops'}</span>
            <button onClick={() => onChangeFocusDepth(focusDepth === 1 ? 2 : 1)} type="button">{focusDepth === 1 ? 'Expand' : 'Tighten'}</button>
            <button onClick={onClearFocus} type="button">Clear</button>
          </>
        ) : (
          <span><strong>{nodes.length}</strong> breakthroughs · <strong>{renderedEdges.length}</strong> visible links</span>
        )}
      </div>

      <div className="graph-overlay graph-legend" aria-label="Relationship legend">
        <span><i className="legend-line enabled" /> enabled</span>
        <span><i className="legend-line improved" /> improved</span>
        <span><i className="legend-line combined" /> combined</span>
        <span><i className="legend-line scaled" /> scaled</span>
        <span><i className="legend-line inspired" /> inspired</span>
        <span><i className="legend-line replaced" /> displaced</span>
      </div>
    </section>
  )
}
