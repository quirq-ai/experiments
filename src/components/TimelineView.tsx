import { useEffect, useMemo, useRef, useState } from 'react'
import { useElementSize } from '../hooks/useElementSize'
import { domainColor, domainLabel } from '../lib/palette'
import { formatYear, timeTicks, yearPosition } from '../lib/time'
import type { TechnologyEdge, TechnologyNode } from '../types'
import { Icon } from './Icon'

interface TimelineViewProps {
  activeDecade: number | null
  edges: readonly TechnologyEdge[]
  nodes: readonly TechnologyNode[]
  selectedId: string | null
  onChangeDecade: (decade: number | null) => void
  onSelectNode: (node: TechnologyNode) => void
}

const QUICK_DECADES = Array.from({ length: 23 }, (_, index) => 2020 - index * 10)
const DECADE_TICK_OFFSETS = [0, 2, 4, 6, 8, 10]
const COMPACT_DOMAIN_LABELS: Record<string, string> = {
  agriculture: 'Food',
  biology: 'Biotech',
  communication: 'Communication',
  computing: 'Computing & AI',
  energy: 'Energy',
  environment: 'Climate',
  industry: 'Industry',
  information: 'Knowledge',
  infrastructure: 'Infrastructure',
  materials: 'Materials',
  medicine: 'Health',
  space: 'Space',
  transport: 'Transport',
}

export function TimelineView({ activeDecade, edges, nodes, selectedId, onChangeDecade, onSelectNode }: TimelineViewProps) {
  const { ref: chartRef, width: chartWidth, height: chartHeight } = useElementSize<HTMLDivElement>({ minimumHeight: 240, minimumWidth: 1 })
  const activePeriodRef = useRef<HTMLButtonElement>(null)
  const decadeStripRef = useRef<HTMLDivElement>(null)
  const orderedNodes = useMemo(() => [...nodes].sort((a, b) => a.year - b.year || b.impact - a.impact), [nodes])
  const dataStartYear = orderedNodes[0]?.year ?? -3_300_000
  const dataEndYear = orderedNodes.at(-1)?.year ?? 2025
  const decadeCounts = useMemo(() => {
    const counts = new Map<number, number>()
    QUICK_DECADES.forEach((decade) => counts.set(decade, 0))
    orderedNodes.forEach((node) => {
      const decade = Math.floor(node.year / 10) * 10
      if (counts.has(decade)) counts.set(decade, (counts.get(decade) ?? 0) + 1)
    })
    return counts
  }, [orderedNodes])
  const rangeNodes = useMemo(() => activeDecade === null
    ? orderedNodes
    : orderedNodes.filter((node) => node.year >= activeDecade && node.year <= activeDecade + 9), [activeDecade, orderedNodes])
  const years = useMemo(() => [...new Set(rangeNodes.map((node) => node.year))], [rangeNodes])
  const [cursorIndex, setCursorIndex] = useState(() => Math.max(0, years.length - 1))
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    setCursorIndex(Math.max(0, years.length - 1))
    setPlaying(false)
  }, [activeDecade, years])

  useEffect(() => {
    if (!playing || !years.length) return
    if (cursorIndex >= years.length - 1) {
      setPlaying(false)
      return
    }
    const timeout = window.setTimeout(() => setCursorIndex((index) => Math.min(years.length - 1, index + 1)), 320)
    return () => window.clearTimeout(timeout)
  }, [cursorIndex, playing, years.length])

  useEffect(() => {
    activePeriodRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [activeDecade])

  const currentYear = years[Math.min(cursorIndex, Math.max(0, years.length - 1))] ?? dataEndYear
  const visibleNodes = useMemo(() => rangeNodes.filter((node) => node.year <= currentYear), [currentYear, rangeNodes])
  const rangeNodeIds = useMemo(() => new Set(rangeNodes.map((node) => node.id)), [rangeNodes])
  const domains = useMemo(() => [...new Set(rangeNodes.map((node) => node.domain))].sort(), [rangeNodes])
  const domainIndex = useMemo(() => new Map(domains.map((domain, index) => [domain, index])), [domains])
  const svgWidth = Math.max(1, chartWidth)
  const plotLeft = svgWidth < 520 ? 82 : svgWidth < 900 ? 98 : 116
  const plotRight = svgWidth < 520 ? 14 : svgWidth < 900 ? 18 : 22
  const plotWidth = Math.max(120, svgWidth - plotLeft - plotRight)
  const minimumLaneHeight = activeDecade === null ? 30 : 52
  const maximumLaneHeight = activeDecade === null ? 44 : 76
  const availableLaneHeight = (Math.max(240, chartHeight) - 76) / Math.max(1, domains.length)
  const laneHeight = Math.max(minimumLaneHeight, Math.min(maximumLaneHeight, availableLaneHeight))
  const laneContentHeight = domains.length * laneHeight
  const svgHeight = Math.max(240, chartHeight, laneContentHeight + 76)
  const laneStart = 52 + Math.max(0, (svgHeight - 76 - laneContentHeight) / 2)
  const periodLabel = activeDecade === null ? 'All history' : `${activeDecade}s`
  const allHistoryStartPosition = yearPosition(dataStartYear)
  const allHistoryEndPosition = yearPosition(dataEndYear)
  const positionForYear = (year: number) => activeDecade === null
    ? Math.max(0, Math.min(1, (yearPosition(year) - allHistoryStartPosition) / Math.max(0.0001, allHistoryEndPosition - allHistoryStartPosition)))
    : Math.max(0, Math.min(1, (year - activeDecade) / 10))
  const axisTicks = useMemo(() => {
    if (activeDecade !== null) {
      return DECADE_TICK_OFFSETS.map((offset) => ({ year: activeDecade + offset, label: String(activeDecade + offset) }))
    }
    const ticks = [
      { year: dataStartYear, label: formatYear(dataStartYear).replace(' CE', '') },
      ...timeTicks.filter((tick) => tick.year > dataStartYear && tick.year < dataEndYear),
      { year: dataEndYear, label: formatYear(dataEndYear).replace(' CE', '') },
    ]
    return [...new Map(ticks.map((tick) => [tick.year, tick])).values()].sort((a, b) => a.year - b.year)
  }, [activeDecade, dataEndYear, dataStartYear])
  const minimumTickGap = svgWidth < 520 ? 50 : svgWidth < 900 ? 58 : 64
  const displayAxisTicks: typeof axisTicks = []
  let lastTickX = Number.NEGATIVE_INFINITY
  axisTicks.forEach((tick, index) => {
    const tickX = positionForYear(tick.year) * plotWidth
    if (index === 0 || tickX - lastTickX >= minimumTickGap) {
      displayAxisTicks.push(tick)
      lastTickX = tickX
    }
  })
  const finalAxisTick = axisTicks.at(-1)
  if (finalAxisTick && displayAxisTicks.at(-1)?.year !== finalAxisTick.year) {
    const finalTickX = positionForYear(finalAxisTick.year) * plotWidth
    const previousTick = displayAxisTicks.at(-1)
    if (previousTick && displayAxisTicks.length > 1 && finalTickX - positionForYear(previousTick.year) * plotWidth < minimumTickGap) {
      displayAxisTicks.pop()
    }
    displayAxisTicks.push(finalAxisTick)
  }
  const stackOffsets = useMemo(() => {
    const groups = new Map<string, TechnologyNode[]>()
    rangeNodes.forEach((node) => {
      const key = `${node.domain}:${node.year}`
      const group = groups.get(key) ?? []
      group.push(node)
      groups.set(key, group)
    })
    const offsets = new Map<string, number>()
    const spacing = activeDecade === null ? 7 : 12
    groups.forEach((group) => {
      group.sort((a, b) => b.impact - a.impact || a.title.localeCompare(b.title))
      group.forEach((node, index) => offsets.set(node.id, (index - (group.length - 1) / 2) * spacing))
    })
    return offsets
  }, [activeDecade, rangeNodes])
  const automaticLabelIds = useMemo(() => {
    if (activeDecade === null || rangeNodes.length > 12 || svgWidth < 520) return new Set<string>()
    const bestByDomain = new Map<string, TechnologyNode>()
    rangeNodes.forEach((node) => {
      const current = bestByDomain.get(node.domain)
      if (!current || node.impact > current.impact || (node.impact === current.impact && node.year < current.year)) {
        bestByDomain.set(node.domain, node)
      }
    })
    return new Set([...bestByDomain.values()].map((node) => node.id))
  }, [activeDecade, rangeNodes, svgWidth])
  const selectedLinks = useMemo(() => {
    if (!selectedId || !rangeNodeIds.has(selectedId)) return new Set<string>()
    const ids = new Set([selectedId])
    edges.forEach((edge) => {
      if (edge.source === selectedId) ids.add(edge.target)
      if (edge.target === selectedId) ids.add(edge.source)
    })
    return ids
  }, [edges, rangeNodeIds, selectedId])

  const startPlayback = () => {
    if (!years.length) return
    if (cursorIndex >= years.length - 1) setCursorIndex(0)
    setPlaying((value) => !value)
  }

  const sliderValue = Math.round(positionForYear(currentYear) * 1000)
  const selectNearestYear = (targetPosition: number) => {
    if (!years.length) return
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    years.forEach((year, index) => {
      const distance = Math.abs(positionForYear(year) - targetPosition)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })
    setCursorIndex(nearestIndex)
  }
  const changePeriod = (decade: number | null) => {
    setPlaying(false)
    setCursorIndex(Number.MAX_SAFE_INTEGER)
    onChangeDecade(decade)
  }
  const scrollDecades = (direction: -1 | 1) => {
    const strip = decadeStripRef.current
    if (!strip) return
    strip.scrollBy({ left: direction * Math.max(240, strip.clientWidth * .75), behavior: 'smooth' })
  }

  if (!nodes.length) {
    return (
      <section className="timeline-view is-empty" aria-labelledby="timeline-title">
        <div className="view-intro timeline-intro">
          <div><span className="eyebrow">Time, stacked by domain</span><h1 id="timeline-title">The long arc of invention</h1></div>
        </div>
        <div className="empty-path"><Icon name="timeline" size={28} /><h2>No milestones match these filters</h2><p>Reset or broaden the filters above to restore the timeline.</p></div>
      </section>
    )
  }

  return (
    <section className="timeline-view" aria-labelledby="timeline-title">
      <div className="view-intro timeline-intro">
        <div>
          <span className="eyebrow">Chronology, stacked by domain</span>
          <h1 id="timeline-title">The long arc of invention</h1>
          <p>{activeDecade === null
            ? 'See the complete record, then jump into any modern decade for a precise ten-year view.'
            : `A focused view of milestones dated from ${activeDecade} through ${activeDecade + 9}.`}</p>
        </div>
        <div className="timeline-player">
          <button className="play-button" disabled={!years.length} onClick={startPlayback} type="button">
            <Icon name={playing ? 'pause' : 'play'} size={15} /> {playing ? 'Pause' : cursorIndex >= years.length - 1 ? `Replay ${activeDecade === null ? 'history' : 'decade'}` : 'Play'}
          </button>
          <strong>{rangeNodes.length ? formatYear(currentYear) : periodLabel}</strong>
          <small>{rangeNodes.length ? `${visibleNodes.length} of ${rangeNodes.length} in ${periodLabel.toLowerCase()}` : 'No matching milestones'}</small>
        </div>
      </div>

      <div className="timeline-window-bar">
        <div className="timeline-window-heading">
          <span className="section-label">Quick time window</span>
          <span><strong>{periodLabel}</strong><small>{rangeNodes.length} milestones</small></span>
        </div>
        <div className="decade-navigation">
          <button aria-label="Show newer decades" className="decade-scroll-button" onClick={() => scrollDecades(-1)} type="button"><Icon name="arrow-left" size={15} /></button>
          <div aria-label="Filter timeline by decade" className="decade-strip" ref={decadeStripRef} role="group">
            <button
              aria-label={`All history, ${nodes.length} milestones`}
              aria-pressed={activeDecade === null}
              className={activeDecade === null ? 'decade-button is-active all-history-button' : 'decade-button all-history-button'}
              onClick={() => changePeriod(null)}
              ref={activeDecade === null ? activePeriodRef : undefined}
              type="button"
            >
              <span>All history</span><small>{nodes.length}</small>
            </button>
            {QUICK_DECADES.map((decade) => {
              const count = decadeCounts.get(decade) ?? 0
              const active = activeDecade === decade
              return (
                <button
                  aria-label={`${decade}s, ${count} ${count === 1 ? 'milestone' : 'milestones'}`}
                  aria-pressed={active}
                  className={active ? 'decade-button is-active' : 'decade-button'}
                  disabled={count === 0 && !active}
                  key={decade}
                  onClick={() => changePeriod(active ? null : decade)}
                  ref={active ? activePeriodRef : undefined}
                  type="button"
                >
                  <span>{decade}s</span><small>{count}</small>
                </button>
              )
            })}
          </div>
          <button aria-label="Show older decades" className="decade-scroll-button" onClick={() => scrollDecades(1)} type="button"><Icon name="arrow-right" size={15} /></button>
        </div>
      </div>

      <div
        className="timeline-scrubber"
        style={{
          marginLeft: `${18 + plotLeft}px`,
          marginRight: `${18 + plotRight}px`,
        }}
      >
        <input
          aria-label="Scrub through historical breakthroughs"
          aria-valuetext={formatYear(currentYear)}
          disabled={!years.length}
          max="1000"
          min="0"
          onChange={(event) => {
            setPlaying(false)
            selectNearestYear(Number(event.target.value) / 1000)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault()
              setPlaying(false)
              setCursorIndex((index) => Math.max(0, index - 1))
            } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault()
              setPlaying(false)
              setCursorIndex((index) => Math.min(years.length - 1, index + 1))
            } else if (event.key === 'Home') {
              event.preventDefault()
              setPlaying(false)
              setCursorIndex(0)
            } else if (event.key === 'End') {
              event.preventDefault()
              setPlaying(false)
              setCursorIndex(Math.max(0, years.length - 1))
            }
          }}
          style={{ '--timeline-progress': `${sliderValue / 10}%` } as React.CSSProperties}
          type="range"
          value={sliderValue}
        />
      </div>

      <div className="timeline-chart-wrap" ref={chartRef}>
        {!rangeNodes.length ? (
          <div className="timeline-range-empty" role="status">
            <Icon name="timeline" size={24} />
            <strong>No {periodLabel} milestones match the current filters</strong>
            <span>Broaden the domain, era, relationship, or impact filters above.</span>
          </div>
        ) : null}
        <svg
          aria-label={`${periodLabel} technology timeline with ${rangeNodes.length} milestones; playback is at ${formatYear(currentYear)}`}
          className="timeline-chart"
          role="group"
          style={{ height: `${svgHeight}px`, minWidth: 0, width: '100%' }}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        >
          <title>{periodLabel} technology timeline</title>
          <desc>Milestones are arranged chronologically from left to right and grouped into labeled technology domains.</desc>
          <defs>
            <linearGradient id="timeline-fade" x1="0" x2="1">
              <stop offset="0" stopColor="var(--background)" stopOpacity="0" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity=".15" />
            </linearGradient>
          </defs>
          <g className="timeline-grid">
            {displayAxisTicks.map((tick) => {
              const x = plotLeft + positionForYear(tick.year) * plotWidth
              return <g key={tick.year} transform={`translate(${x} 0)`}><line y1="30" y2={svgHeight - 18} /><text y="18" textAnchor="middle">{tick.label}</text></g>
            })}
            {domains.map((domain, index) => {
              const y = laneStart + index * laneHeight + laneHeight / 2
              return (
                <g className="timeline-lane" key={domain}>
                  <line x1={plotLeft} x2={svgWidth - plotRight} y1={y} y2={y} />
                  <text aria-label={domainLabel(domain)} x="8" y={y + 4}>{svgWidth < 520 ? COMPACT_DOMAIN_LABELS[domain] ?? domainLabel(domain) : domainLabel(domain)}</text>
                </g>
              )
            })}
          </g>

          <rect
            className="timeline-progress-wash"
            height={svgHeight - 42}
            width={positionForYear(currentYear) * plotWidth}
            x={plotLeft}
            y="26"
          />
          <line
            className="timeline-cursor"
            x1={plotLeft + positionForYear(currentYear) * plotWidth}
            x2={plotLeft + positionForYear(currentYear) * plotWidth}
            y1="26"
            y2={svgHeight - 16}
          />

          <g className="timeline-marks">
            {rangeNodes.map((node) => {
              const lane = domainIndex.get(node.domain) ?? 0
              const x = plotLeft + positionForYear(node.year) * plotWidth
              const centerY = laneStart + lane * laneHeight + laneHeight / 2
              const y = centerY + Math.max(-laneHeight * .3, Math.min(laneHeight * .3, stackOffsets.get(node.id) ?? 0))
              const selected = selectedId === node.id
              const related = selectedLinks.has(node.id)
              const future = node.year > currentYear
              const radius = 3.4 + node.impact * 1.3
              const labelOnLeft = x > svgWidth - plotRight - 145
              const showLabel = svgWidth >= 520 && (selected || automaticLabelIds.has(node.id))
              return (
                <g
                  aria-label={`${node.title}, ${node.yearLabel}`}
                  aria-current={selected ? 'true' : undefined}
                  className={`timeline-node${selected ? ' is-selected' : ''}${selectedLinks.size && !related ? ' is-muted' : ''}${future ? ' is-future' : ''}`}
                  key={node.id}
                  onClick={() => onSelectNode(node)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectNode(node)
                    }
                  }}
                  role="button"
                  style={{ '--node-color': domainColor(node.domain) } as React.CSSProperties}
                  tabIndex={activeDecade !== null || selected || node.impact === 5 ? 0 : -1}
                  transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
                >
                  <circle className="timeline-hit" r={Math.max(14, radius + 6)} />
                  {selected ? <circle className="timeline-ring" r={radius + 6} /> : null}
                  <circle className="timeline-dot" r={radius} />
                  {showLabel ? (
                    <text textAnchor={labelOnLeft ? 'end' : 'start'} x={labelOnLeft ? -(radius + 7) : radius + 7} y="4">{node.title}</text>
                  ) : null}
                  <title>{node.title} · {node.yearLabel}\n{node.summary}</title>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </section>
  )
}
