import { domainColor } from '../lib/palette'
import { Icon } from './Icon'

interface FilterBarProps {
  activeDomains: ReadonlySet<string>
  activeEra: string
  activeRelationship: string
  domains: Array<{ id: string; label: string; count: number }>
  eras: Array<{ id: string; label: string; count: number }>
  minimumImpact: number
  nodeCount: number
  relationshipTypes: string[]
  onChangeEra: (era: string) => void
  onChangeImpact: (impact: number) => void
  onChangeRelationship: (relationship: string) => void
  onReset: () => void
  onToggleDomain: (domain: string) => void
}

const humanize = (value: string) => value.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())

export function FilterBar({
  activeDomains,
  activeEra,
  activeRelationship,
  domains,
  eras,
  minimumImpact,
  nodeCount,
  relationshipTypes,
  onChangeEra,
  onChangeImpact,
  onChangeRelationship,
  onReset,
  onToggleDomain,
}: FilterBarProps) {
  const hasFilters = activeDomains.size > 0 || activeEra !== 'all' || activeRelationship !== 'all' || minimumImpact > 1

  return (
    <div aria-label="Filter milestones" className="filter-bar" role="region">
      <details className="filter-menu">
        <summary>
          <Icon name="layers" size={15} />
          Domains
          {activeDomains.size ? <span className="filter-count">{activeDomains.size}</span> : null}
          <Icon name="chevron-down" size={13} />
        </summary>
        <div className="filter-popover domain-options">
          <div className="filter-popover-heading">
            <span>Show domains</span>
            <small>{activeDomains.size ? `${activeDomains.size} selected` : 'All visible'}</small>
          </div>
          {domains.map((domain) => (
            <label className="filter-option" key={domain.id}>
              <input
                checked={activeDomains.size === 0 || activeDomains.has(domain.id)}
                onChange={() => onToggleDomain(domain.id)}
                type="checkbox"
              />
              <span className="domain-swatch" style={{ background: domainColor(domain.id) }} />
              <span>{domain.label}</span>
              <small>{domain.count}</small>
            </label>
          ))}
        </div>
      </details>

      <label className="compact-select">
        <span>Era</span>
        <select aria-label="Filter by era" onChange={(event) => onChangeEra(event.target.value)} value={activeEra}>
          <option value="all">All eras</option>
          {eras.map((era) => <option key={era.id} value={era.id}>{era.label} ({era.count})</option>)}
        </select>
      </label>

      <label className="compact-select relationship-select">
        <span>Relationship</span>
        <select aria-label="Filter by relationship" onChange={(event) => onChangeRelationship(event.target.value)} value={activeRelationship}>
          <option value="all">All relationships</option>
          {relationshipTypes.map((type) => <option key={type} value={type}>{humanize(type)}</option>)}
        </select>
      </label>

      <label className="impact-filter">
        <span>Impact <strong>{minimumImpact}+</strong></span>
        <input
          aria-label="Minimum historical impact"
          max="5"
          min="1"
          onChange={(event) => onChangeImpact(Number(event.target.value))}
          step="1"
          type="range"
          value={minimumImpact}
        />
      </label>

      <span className="visible-count">{nodeCount} visible</span>
      <button className="reset-filters" disabled={!hasFilters} onClick={onReset} type="button">
        <Icon name="close" size={13} /> Reset
      </button>
    </div>
  )
}
