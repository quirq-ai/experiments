import { useEffect, useRef } from 'react'
import type { GraphIndex } from '../lib/graph'
import { domainColor, domainLabel, eraLabel } from '../lib/palette'
import type { TechnologyNode } from '../types'
import { Icon } from './Icon'

interface DetailPanelProps {
  graphIndex: GraphIndex
  node: TechnologyNode
  onClose: () => void
  onFocusGraph: (node: TechnologyNode) => void
  onSelectNode: (node: TechnologyNode) => void
  onShowTimeline: (node: TechnologyNode) => void
}

export function DetailPanel({ graphIndex, node, onClose, onFocusGraph, onSelectNode, onShowTimeline }: DetailPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const incoming = graphIndex.edgesByTarget.get(node.id) ?? []
  const outgoing = graphIndex.edgesBySource.get(node.id) ?? []
  const color = domainColor(node.domain)

  const relationButton = (edge: (typeof incoming)[number], relationNode: TechnologyNode | undefined) => relationNode ? (
    <button className="relation-row" key={`${edge.source}-${edge.target}-${edge.type}`} onClick={() => onSelectNode(relationNode)} type="button">
      <span className="relation-dot" style={{ background: domainColor(relationNode.domain) }} />
        <span className="relation-copy">
          <strong>{relationNode.title}</strong>
          <small>{edge.label} · {relationNode.yearLabel}</small>
          <em>{edge.description}</em>
      </span>
      <Icon name="arrow-right" size={14} />
    </button>
  ) : null

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [node.id])

  return (
    <aside aria-labelledby="detail-title" aria-modal="false" className="detail-panel" role="dialog" style={{ '--node-color': color } as React.CSSProperties}>
      <div className="detail-accent" />
      <button aria-label="Close details" className="detail-close" data-testid="close-details" onClick={onClose} type="button"><Icon name="close" size={18} /></button>
      <div className="detail-scroll" ref={scrollRef}>
        <header className="detail-header">
          <div className="detail-kicker"><span>{domainLabel(node.domain)}</span><i /> <span>{eraLabel(node.era)}</span></div>
          <h2 id="detail-title">{node.title}</h2>
          <p className="detail-summary">{node.summary}</p>
          <dl className="detail-facts">
            <div><dt>Date</dt><dd>{node.yearLabel}</dd></div>
            <div><dt>Origin / record</dt><dd>{node.location}</dd></div>
            <div><dt>Impact</dt><dd>{node.impact} / 5</dd></div>
            <div><dt>Date confidence</dt><dd className={`confidence confidence-${node.confidence}`}>{node.confidence}</dd></div>
          </dl>
          <div className="detail-actions">
            <button className="primary-button" onClick={() => onFocusGraph(node)} type="button"><Icon name="network" size={14} /> Focus in graph</button>
            <button className="secondary-button" onClick={() => onShowTimeline(node)} type="button"><Icon name="timeline" size={14} /> Show on timeline</button>
          </div>
        </header>

        <div className="detail-section">
          <span className="section-label">Why it mattered</span>
          <p>{node.description}</p>
        </div>

        {node.people.length ? (
          <div className="detail-section">
            <span className="section-label">Contributors & cultures</span>
            <div className="people-list">{node.people.map((person) => <span key={person}>{person}</span>)}</div>
            <p className="detail-note"><Icon name="compass" size={13} /> Attribution reflects documented contribution, not a single “hero inventor.”</p>
          </div>
        ) : null}

        <div className="detail-section relation-section">
          <span className="section-label">Built on</span>
          {incoming.length ? incoming.slice(0, 6).map((edge) => relationButton(edge, graphIndex.nodeById.get(edge.source))) : <p className="empty-relation">No earlier dependency is documented in this edition.</p>}
        </div>

        <div className="detail-section relation-section">
          <span className="section-label">Helped unlock</span>
          {outgoing.length ? outgoing.slice(0, 6).map((edge) => relationButton(edge, graphIndex.nodeById.get(edge.target))) : <p className="empty-relation">No later dependency is documented in this edition.</p>}
        </div>

        <div className="detail-section">
          <span className="section-label">Themes</span>
          <div className="tag-list">{node.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
        </div>

        {node.sources.length ? (
          <div className="detail-section sources-section">
            <span className="section-label">Further reading</span>
            {node.sources.map((source) => (
              <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                <span><strong>{source.label}</strong>{source.publisher ? <small>{source.publisher}</small> : null}</span>
                <Icon name="external" size={14} />
              </a>
            ))}
          </div>
        ) : null}

        <p className="uncertainty-note"><Icon name="compass" size={14} /> Dates mark earliest evidence, description, demonstration, or adoption depending on the record. “c.” and ranges are deliberate.</p>
      </div>
    </aside>
  )
}
