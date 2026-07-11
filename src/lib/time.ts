export const timeTicks = [
  { year: -3_300_000, label: '3.3m BCE' },
  { year: -10_000, label: '10k BCE' },
  { year: -3000, label: '3000 BCE' },
  { year: 1, label: '1 CE' },
  { year: 1500, label: '1500' },
  { year: 1800, label: '1800' },
  { year: 1900, label: '1900' },
  { year: 1950, label: '1950' },
  { year: 2000, label: '2000' },
  { year: 2025, label: 'Today' },
]

const segments = [
  { from: -3_300_000, to: -10_000, start: 0, end: 0.12, log: true },
  { from: -10_000, to: -3000, start: 0.12, end: 0.22 },
  { from: -3000, to: 1, start: 0.22, end: 0.33 },
  { from: 1, to: 1500, start: 0.33, end: 0.45 },
  { from: 1500, to: 1800, start: 0.45, end: 0.58 },
  { from: 1800, to: 1900, start: 0.58, end: 0.7 },
  { from: 1900, to: 1950, start: 0.7, end: 0.79 },
  { from: 1950, to: 2000, start: 0.79, end: 0.91 },
  { from: 2000, to: 2025, start: 0.91, end: 1 },
]

export function yearPosition(year: number): number {
  const clamped = Math.max(-3_300_000, Math.min(2025, year))
  const segment = segments.find(({ from, to }) => clamped >= from && clamped <= to) ?? segments.at(-1)!
  let local: number
  if (segment.log) {
    const fromLog = Math.log10(Math.abs(segment.from))
    const toLog = Math.log10(Math.abs(segment.to))
    local = (fromLog - Math.log10(Math.abs(clamped))) / (fromLog - toLog)
  } else {
    local = (clamped - segment.from) / (segment.to - segment.from)
  }
  return segment.start + local * (segment.end - segment.start)
}

export function formatYear(year: number): string {
  if (year < -999_999) return `${(Math.abs(year) / 1_000_000).toFixed(1)}m BCE`
  if (year < -9999) return `${Math.round(Math.abs(year) / 1000)}k BCE`
  if (year < 0) return `${Math.abs(year).toLocaleString()} BCE`
  return `${year} CE`
}

export function seededUnit(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) / 4_294_967_295
}
