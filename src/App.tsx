import { useEffect, useMemo, useRef, useState } from 'react'
import { domainDefinitions, eraDefinitions, storyTours, technologyEdges, technologyNodes } from './data/technologyGraph'
import { DetailPanel } from './components/DetailPanel'
import { FilterBar } from './components/FilterBar'
import { GraphView, type GraphLayout } from './components/GraphView'
import { Header } from './components/Header'
import { PathfinderView } from './components/PathfinderView'
import { StoriesView, type StoryTour } from './components/StoriesView'
import { TimelineView } from './components/TimelineView'
import { buildGraphIndex, getDomainMetadata, getEraMetadata } from './lib/graph'
import type { TechnologyNode, ViewId } from './types'
import './styles.css'

export default function App() {
  const mainRef = useRef<HTMLElement>(null)
  const [view, setView] = useState<ViewId>('graph')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [focusDepth, setFocusDepth] = useState<1 | 2>(1)
  const [highlightedPath, setHighlightedPath] = useState<string[]>([])
  const [graphLayout, setGraphLayout] = useState<GraphLayout>('constellation')
  const [timelineDecade, setTimelineDecade] = useState<number | null>(null)
  const [activeDomains, setActiveDomains] = useState<Set<string>>(() => new Set())
  const [activeEra, setActiveEra] = useState('all')
  const [activeRelationship, setActiveRelationship] = useState('all')
  const [minimumImpact, setMinimumImpact] = useState(1)

  const graphIndex = useMemo(() => buildGraphIndex(technologyNodes, technologyEdges), [])
  const domainMetadata = useMemo(() => getDomainMetadata(technologyNodes), [])
  const eraMetadata = useMemo(() => getEraMetadata(technologyNodes), [])
  const domainFilters = useMemo(() => domainMetadata.map((item) => ({
    ...item,
    label: domainDefinitions.find((definition) => definition.id === item.id)?.name ?? item.label,
  })), [domainMetadata])
  const eraFilters = useMemo(() => eraMetadata.map((item) => ({
    ...item,
    label: eraDefinitions.find((definition) => definition.id === item.id)?.name ?? item.label,
  })), [eraMetadata])
  const relationshipTypes = useMemo(() => [...new Set(technologyEdges.map((edge) => edge.type))].sort(), [])
  const selectedNode = selectedId ? graphIndex.nodeById.get(selectedId) ?? null : null
  const hasFilters = view === 'graph' || view === 'timeline'
  const hasDetail = detailOpen && selectedNode !== null

  const filteredNodes = useMemo(() => technologyNodes.filter((node) => {
    if (activeDomains.size && !activeDomains.has(node.domain)) return false
    if (activeEra !== 'all' && node.era !== activeEra) return false
    return node.impact >= minimumImpact
  }), [activeDomains, activeEra, minimumImpact])

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes])
  const filteredEdges = useMemo(() => technologyEdges.filter((edge) => {
    if (!filteredNodeIds.has(edge.source) || !filteredNodeIds.has(edge.target)) return false
    return activeRelationship === 'all' || edge.type === activeRelationship
  }), [activeRelationship, filteredNodeIds])

  useEffect(() => {
    if (focusId && !filteredNodeIds.has(focusId)) setFocusId(null)
  }, [filteredNodeIds, focusId])

  useEffect(() => {
    if (!detailOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDetailOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [detailOpen])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 })
  }, [view])

  const resetFilters = () => {
    setActiveDomains(new Set())
    setActiveEra('all')
    setActiveRelationship('all')
    setMinimumImpact(1)
    setTimelineDecade(null)
  }

  const openGraphNode = (node: TechnologyNode, focus = true) => {
    setSelectedId(node.id)
    setDetailOpen(true)
    if (focus) {
      setFocusId(node.id)
      setFocusDepth(1)
      setHighlightedPath([])
    }
  }

  const selectFromSearch = (node: TechnologyNode) => {
    resetFilters()
    setView('graph')
    openGraphNode(node, true)
  }

  const focusInGraph = (node: TechnologyNode) => {
    resetFilters()
    setView('graph')
    setSelectedId(node.id)
    setFocusId(node.id)
    setFocusDepth(1)
    setHighlightedPath([])
    setDetailOpen(false)
  }

  const showOnTimeline = (node: TechnologyNode) => {
    resetFilters()
    const decade = Math.floor(node.year / 10) * 10
    setTimelineDecade(decade >= 1800 && decade <= 2020 ? decade : null)
    setSelectedId(node.id)
    setDetailOpen(false)
    setView('timeline')
  }

  const traceRoute = (nodeIds: readonly string[]) => {
    resetFilters()
    setDetailOpen(false)
    setHighlightedPath([...nodeIds])
    setSelectedId(nodeIds.at(-1) ?? null)
    setFocusId(null)
    setGraphLayout('chronology')
    setView('graph')
  }

  const toggleDomain = (domain: string) => {
    setActiveDomains((current) => {
      const next = current.size === 0
        ? new Set(domainMetadata.map((item) => item.id))
        : new Set(current)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      if (next.size === domainMetadata.length || next.size === 0) return new Set()
      return next
    })
  }

  const changeView = (nextView: ViewId) => {
    setView(nextView)
    if (nextView !== 'graph') setHighlightedPath([])
  }

  return (
    <div className={`app-shell is-${view}${hasFilters ? ' has-filters' : ''}${hasDetail ? ' has-detail' : ''}`}>
      <Header
        activeView={view}
        edgeCount={technologyEdges.length}
        nodes={technologyNodes}
        onChangeView={changeView}
        onSelectNode={selectFromSearch}
      />

      {hasFilters ? (
        <FilterBar
          activeDomains={activeDomains}
          activeEra={activeEra}
          activeRelationship={activeRelationship}
          domains={domainFilters}
          eras={eraFilters}
          minimumImpact={minimumImpact}
          nodeCount={filteredNodes.length}
          onChangeEra={setActiveEra}
          onChangeImpact={setMinimumImpact}
          onChangeRelationship={setActiveRelationship}
          onReset={resetFilters}
          onToggleDomain={toggleDomain}
          relationshipTypes={relationshipTypes}
        />
      ) : null}

      <div className={`app-workspace${hasDetail ? ' has-detail' : ''}`}>
        <main className={`app-main view-${view}`} id="main-content" ref={mainRef}>
          {view === 'graph' ? (
            <GraphView
              edges={filteredEdges}
              focusDepth={focusDepth}
              focusId={focusId}
              highlightedPath={highlightedPath}
              layout={graphLayout}
              nodes={filteredNodes}
              onChangeFocusDepth={setFocusDepth}
              onChangeLayout={setGraphLayout}
              onClearFocus={() => {
                setFocusId(null)
                setHighlightedPath([])
              }}
              onSelectNode={openGraphNode}
              selectedId={selectedId}
            />
          ) : null}

          {view === 'timeline' ? (
            <TimelineView
              activeDecade={timelineDecade}
              edges={filteredEdges}
              nodes={filteredNodes}
              onChangeDecade={setTimelineDecade}
              onSelectNode={(node) => {
                setSelectedId(node.id)
                setDetailOpen(true)
              }}
              selectedId={selectedId}
            />
          ) : null}

          {view === 'paths' ? (
            <PathfinderView
              graphIndex={graphIndex}
              nodes={technologyNodes}
              onSelectNode={(node) => {
                setSelectedId(node.id)
                setDetailOpen(true)
              }}
              onTracePath={traceRoute}
            />
          ) : null}

          {view === 'stories' ? (
            <StoriesView
              nodes={technologyNodes}
              onSelectNode={(node) => {
                setSelectedId(node.id)
                setDetailOpen(true)
              }}
              onTraceStory={traceRoute}
              stories={storyTours as readonly StoryTour[]}
            />
          ) : null}
        </main>

        {detailOpen && selectedNode ? (
          <>
            <button aria-label="Close details" className="detail-backdrop" onClick={() => setDetailOpen(false)} tabIndex={-1} type="button" />
            <DetailPanel
              graphIndex={graphIndex}
              node={selectedNode}
              onClose={() => setDetailOpen(false)}
              onFocusGraph={focusInGraph}
              onSelectNode={(node) => {
                setSelectedId(node.id)
                setDetailOpen(true)
              }}
              onShowTimeline={showOnTimeline}
            />
          </>
        ) : null}
      </div>

      <footer className="app-footer">
        <p><span className="footer-pulse" /> Curated edition 01 · {technologyNodes.length} breakthroughs · {technologyEdges.length} documented and contextual links</p>
        <p>Dates can mean earliest evidence, description, demonstration, or adoption. Ranges and uncertainty are shown deliberately.</p>
      </footer>
    </div>
  )
}
