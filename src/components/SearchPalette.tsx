import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { TechnologyNode } from '../types'
import { domainColor, domainLabel, eraLabel } from '../lib/palette'
import { Icon } from './Icon'

interface SearchPaletteProps {
  nodes: readonly TechnologyNode[]
  onSelect: (node: TechnologyNode) => void
}

function searchScore(node: TechnologyNode, normalizedQuery: string) {
  const title = node.title.toLowerCase()
  const domain = `${node.domain} ${domainLabel(node.domain)}`.toLowerCase()
  const context = [eraLabel(node.era), node.location, ...node.people, ...node.tags].join(' ').toLowerCase()
  if (title === normalizedQuery) return 100
  if (title.startsWith(normalizedQuery)) return 80
  if (title.includes(normalizedQuery)) return 60
  if (domain.includes(normalizedQuery)) return 35
  if (context.includes(normalizedQuery)) return 20
  return 0
}

export function SearchPalette({ nodes, onSelect }: SearchPaletteProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const deferredQuery = useDeferredValue(query)
  const inputRef = useRef<HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()
    if (!normalized) return []
    return nodes
      .map((node) => ({ node, score: searchScore(node, normalized) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || b.node.impact - a.node.impact || a.node.year - b.node.year)
      .slice(0, 8)
      .map(({ node }) => node)
  }, [deferredQuery, nodes])

  useEffect(() => {
    setActiveIndex((index) => Math.min(index, Math.max(0, results.length - 1)))
  }, [results.length])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (event.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (shellRef.current && !shellRef.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [])

  const choose = (node: TechnologyNode) => {
    setQuery(node.title)
    setOpen(false)
    onSelect(node)
  }

  return (
    <div className="search-shell" ref={shellRef}>
      <Icon name="search" size={16} />
      <input
        ref={inputRef}
        aria-activedescendant={open && results[activeIndex] ? `search-${results[activeIndex].id}` : undefined}
        aria-autocomplete="list"
        aria-controls="global-search-results"
        aria-expanded={open && Boolean(query.trim())}
        aria-label="Search the technology atlas"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value)
          setActiveIndex(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!results.length) return
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setActiveIndex((index) => (index + 1) % results.length)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActiveIndex((index) => (index - 1 + results.length) % results.length)
          } else if (event.key === 'Home') {
            event.preventDefault()
            setActiveIndex(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            setActiveIndex(results.length - 1)
          } else if (event.key === 'Enter') {
            event.preventDefault()
            choose(results[activeIndex])
          }
        }}
        placeholder="Search inventions, eras, people…"
        role="combobox"
        value={query}
      />
      <kbd>/</kbd>
      {open && query.trim() ? (
        <div className="search-results" id="global-search-results" role="listbox">
          {results.length ? (
            results.map((node, index) => (
              <button
                className={index === activeIndex ? 'search-result is-active' : 'search-result'}
                id={`search-${node.id}`}
                key={node.id}
                onClick={() => choose(node)}
                onMouseEnter={() => setActiveIndex(index)}
                role="option"
                aria-selected={index === activeIndex}
                type="button"
              >
                <span className="search-result-mark" style={{ '--node-color': domainColor(node.domain) } as React.CSSProperties} />
                <span>
                  <strong>{node.title}</strong>
                  <small>{domainLabel(node.domain)} · {node.yearLabel}</small>
                </span>
                <span className="search-impact">{node.impact}/5</span>
              </button>
            ))
          ) : (
            <div className="search-empty">No match yet. Try a domain, person, or invention.</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
