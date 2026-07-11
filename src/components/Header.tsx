import type { TechnologyNode, ViewId } from '../types'
import { Icon, type IconName } from './Icon'
import { SearchPalette } from './SearchPalette'

const views: Array<{ id: ViewId; label: string; icon: IconName }> = [
  { id: 'graph', label: 'Graph', icon: 'network' },
  { id: 'timeline', label: 'Timeline', icon: 'timeline' },
  { id: 'paths', label: 'Connections', icon: 'route' },
  { id: 'stories', label: 'Stories', icon: 'sparkles' },
]

interface HeaderProps {
  activeView: ViewId
  edgeCount: number
  nodes: readonly TechnologyNode[]
  onChangeView: (view: ViewId) => void
  onSelectNode: (node: TechnologyNode) => void
}

export function Header({ activeView, edgeCount, nodes, onChangeView, onSelectNode }: HeaderProps) {
  return (
    <header className="app-header">
      <button className="brand" onClick={() => onChangeView('graph')} type="button">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="brand-copy">
          <strong>Technologia</strong>
          <small>The human stack</small>
        </span>
      </button>

      <nav aria-label="Primary views" className="primary-nav">
        {views.map((view) => (
          <button
            aria-current={activeView === view.id ? 'page' : undefined}
            className={activeView === view.id ? 'nav-item is-active' : 'nav-item'}
            data-testid={`view-${view.id}`}
            key={view.id}
            onClick={() => onChangeView(view.id)}
            type="button"
          >
            <Icon name={view.icon} size={15} />
            <span>{view.label}</span>
          </button>
        ))}
      </nav>

      <div className="header-tools">
        <SearchPalette nodes={nodes} onSelect={onSelectNode} />
      </div>

      <div className="mobile-data-line" aria-hidden="true">
        <span>{nodes.length} breakthroughs</span>
        <span>{edgeCount} links</span>
      </div>
    </header>
  )
}
