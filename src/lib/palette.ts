const domainTokens = [
  'var(--domain-computing)',
  'var(--domain-communication)',
  'var(--domain-energy)',
  'var(--domain-materials)',
  'var(--domain-manufacturing)',
  'var(--domain-medicine)',
  'var(--domain-agriculture)',
  'var(--domain-transport)',
  'var(--domain-measurement)',
  'var(--domain-space)',
  'var(--domain-infrastructure)',
  'var(--domain-biotechnology)',
]

const keywordTokens: Array<[string, string]> = [
  ['comput', 'var(--domain-computing)'],
  ['ai', 'var(--domain-computing)'],
  ['information', 'var(--domain-computing)'],
  ['communicat', 'var(--domain-communication)'],
  ['media', 'var(--domain-communication)'],
  ['energy', 'var(--domain-energy)'],
  ['material', 'var(--domain-materials)'],
  ['manufactur', 'var(--domain-manufacturing)'],
  ['tool', 'var(--domain-manufacturing)'],
  ['medic', 'var(--domain-medicine)'],
  ['health', 'var(--domain-medicine)'],
  ['biotech', 'var(--domain-biotechnology)'],
  ['agricultur', 'var(--domain-agriculture)'],
  ['food', 'var(--domain-agriculture)'],
  ['transport', 'var(--domain-transport)'],
  ['mobility', 'var(--domain-transport)'],
  ['measure', 'var(--domain-measurement)'],
  ['science', 'var(--domain-measurement)'],
  ['space', 'var(--domain-space)'],
  ['navigat', 'var(--domain-space)'],
  ['infrastruct', 'var(--domain-infrastructure)'],
  ['construct', 'var(--domain-infrastructure)'],
]

const exactDomainTokens: Record<string, string> = {
  agriculture: 'var(--domain-agriculture)',
  biology: 'var(--domain-biotechnology)',
  communication: 'var(--domain-communication)',
  computing: 'var(--domain-computing)',
  energy: 'var(--domain-energy)',
  environment: 'var(--domain-environment)',
  industry: 'var(--domain-industry)',
  information: 'var(--domain-information)',
  infrastructure: 'var(--domain-infrastructure)',
  materials: 'var(--domain-materials)',
  medicine: 'var(--domain-medicine)',
  space: 'var(--domain-space)',
  transport: 'var(--domain-transport)',
}

const domainLabels: Record<string, string> = {
  agriculture: 'Food & Agriculture',
  biology: 'Biology & Biotech',
  communication: 'Communication',
  computing: 'Computing & AI',
  energy: 'Energy',
  environment: 'Climate & Environment',
  industry: 'Industry & Production',
  information: 'Knowledge & Media',
  infrastructure: 'Cities & Infrastructure',
  materials: 'Materials & Making',
  medicine: 'Medicine & Public Health',
  space: 'Space',
  transport: 'Transport & Navigation',
}

const eraLabels: Record<string, string> = {
  ancient: 'Ancient Networks',
  contemporary: 'Convergent Frontiers',
  'deep-prehistory': 'Deep Prehistory',
  'early-modern': 'Print & Experiment',
  industrial: 'Industrial Transformation',
  information: 'Information Age',
  medieval: 'Medieval Exchange',
  modern: 'Machine Age',
  neolithic: 'Neolithic Transitions',
  networked: 'Networked World',
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(31, hash) + value.charCodeAt(index) | 0
  return Math.abs(hash)
}

export function domainColor(domain: string) {
  if (exactDomainTokens[domain]) return exactDomainTokens[domain]
  const normalized = domain.toLowerCase()
  const match = keywordTokens.find(([keyword]) => normalized.includes(keyword))
  return match?.[1] ?? domainTokens[hashString(domain) % domainTokens.length]
}

export function domainLabel(domain: string) {
  return domainLabels[domain] ?? domain.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function eraLabel(era: string) {
  return eraLabels[era] ?? era.replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function edgeColor(type: string) {
  if (type.includes('replace')) return 'var(--edge-replaced)'
  if (type.includes('combine')) return 'var(--edge-combined)'
  if (type.includes('improve')) return 'var(--edge-improved)'
  if (type.includes('scale')) return 'var(--edge-scaled)'
  if (type.includes('inspir')) return 'var(--edge-inspired)'
  return 'var(--edge-enabled)'
}
