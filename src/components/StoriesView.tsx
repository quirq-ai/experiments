import { useEffect, useMemo, useState } from 'react'
import { domainColor, domainLabel } from '../lib/palette'
import type { TechnologyNode } from '../types'
import { Icon } from './Icon'

export interface StoryTour {
  id: string
  title: string
  kicker?: string
  summary?: string
  description?: string
  nodeIds: readonly string[]
  accent?: string
  color?: string
}

interface StoriesViewProps {
  nodes: readonly TechnologyNode[]
  stories: readonly StoryTour[]
  onSelectNode: (node: TechnologyNode) => void
  onTraceStory: (nodeIds: readonly string[]) => void
}

export function StoriesView({ nodes, stories, onSelectNode, onTraceStory }: StoriesViewProps) {
  const [storyIndex, setStoryIndex] = useState(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const story = stories[Math.min(storyIndex, Math.max(0, stories.length - 1))]
  const storyNodes = useMemo(() => story?.nodeIds.flatMap((id) => nodeById.get(id) ?? []) ?? [], [nodeById, story])
  const activeNode = storyNodes[Math.min(step, Math.max(0, storyNodes.length - 1))]

  useEffect(() => {
    setStep(0)
    setPlaying(false)
  }, [storyIndex])

  useEffect(() => {
    if (!playing || storyNodes.length < 2) return
    const timeout = window.setTimeout(() => {
      setStep((current) => {
        if (current >= storyNodes.length - 1) {
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, 2200)
    return () => window.clearTimeout(timeout)
  }, [playing, step, storyNodes.length])

  if (!story || !activeNode) {
    return <section className="stories-view"><div className="empty-path"><h2>Stories are being curated.</h2></div></section>
  }

  const setActiveStep = (index: number) => {
    setStep(index)
    setPlaying(false)
  }

  return (
    <section className="stories-view" aria-labelledby="stories-title">
      <div className="view-intro stories-intro">
        <div>
          <span className="eyebrow">Curated expeditions</span>
          <h1 id="stories-title">Follow the threads that changed daily life</h1>
          <p>Guided routes reveal the handoffs, convergences, and unintended consequences hidden inside the graph.</p>
        </div>
        <button className="secondary-button" onClick={() => onTraceStory(story.nodeIds)} type="button"><Icon name="network" size={15} /> Open this route in graph</button>
      </div>

      <div className="stories-layout">
        <nav className="story-library" aria-label="Technology stories">
          <span className="section-label">Choose a story</span>
          {stories.map((candidate, index) => {
            const firstNode = nodeById.get(candidate.nodeIds[0])
            return (
              <button
                aria-current={index === storyIndex ? 'true' : undefined}
                className={index === storyIndex ? 'story-choice is-active' : 'story-choice'}
                key={candidate.id}
                onClick={() => setStoryIndex(index)}
                type="button"
              >
                <span className="story-choice-number">{String(index + 1).padStart(2, '0')}</span>
                <span>
                  <small>{candidate.kicker ?? `${candidate.nodeIds.length} stops`}</small>
                  <strong>{candidate.title}</strong>
                  <em>{firstNode?.yearLabel} → {nodeById.get(candidate.nodeIds.at(-1) ?? '')?.yearLabel}</em>
                </span>
                <Icon name="arrow-right" size={15} />
              </button>
            )
          })}
        </nav>

        <div className="story-player">
          <div className="story-player-heading">
            <div>
              <span className="eyebrow">{story.kicker ?? 'Guided path'}</span>
              <h2>{story.title}</h2>
              <p>{story.summary ?? story.description}</p>
            </div>
            <button aria-label={playing ? 'Pause story' : 'Play story'} aria-pressed={playing} className="round-play" onClick={() => {
              if (step >= storyNodes.length - 1) setStep(0)
              setPlaying((value) => !value)
            }} type="button"><Icon name={playing ? 'pause' : 'play'} size={18} /></button>
          </div>

          <div className="story-progress" aria-label={`${story.title} milestones`}>
            {storyNodes.map((node, index) => (
              <button
                aria-label={`Step ${index + 1}: ${node.title}`}
                aria-pressed={index === step}
                className={index <= step ? 'is-complete' : ''}
                key={node.id}
                onClick={() => setActiveStep(index)}
                style={{ '--node-color': domainColor(node.domain) } as React.CSSProperties}
                type="button"
              ><span /></button>
            ))}
          </div>

          <article className="story-milestone">
            <div className="milestone-meta">
              <span className="milestone-index">{String(step + 1).padStart(2, '0')} / {String(storyNodes.length).padStart(2, '0')}</span>
              <span className="domain-pill" style={{ '--node-color': domainColor(activeNode.domain) } as React.CSSProperties}><i />{domainLabel(activeNode.domain)}</span>
              <span>{activeNode.yearLabel}</span>
              <span>{activeNode.location}</span>
            </div>
            <h3>{activeNode.title}</h3>
            <p className="milestone-lead">{activeNode.summary}</p>
            <p>{activeNode.description}</p>
            <div className="milestone-actions">
              <button className="secondary-button" onClick={() => onSelectNode(activeNode)} type="button">Inspect breakthrough <Icon name="arrow-right" size={14} /></button>
              <div className="story-stepper">
                <button aria-label="Previous story milestone" disabled={step === 0} onClick={() => setActiveStep(Math.max(0, step - 1))} type="button"><Icon name="arrow-left" size={16} /></button>
                <button aria-label="Next story milestone" disabled={step >= storyNodes.length - 1} onClick={() => setActiveStep(Math.min(storyNodes.length - 1, step + 1))} type="button"><Icon name="arrow-right" size={16} /></button>
              </div>
            </div>
          </article>

          <div className="story-strip">
            {storyNodes.map((node, index) => (
              <button aria-current={index === step ? 'step' : undefined} className={index === step ? 'is-active' : ''} key={node.id} onClick={() => setActiveStep(index)} type="button">
                <i style={{ background: domainColor(node.domain) }} />
                <span>{node.yearLabel}</span>
                <strong>{node.title}</strong>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
