import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Call, Meta } from './types'

export const RANGES = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'all', label: 'All time', days: 0 },
] as const
export type RangeKey = (typeof RANGES)[number]['key']

export interface Filters {
  range: RangeKey
  topic: string
  outcome: string
  sent: string
  flagged: boolean
  q: string
}

const DEFAULTS: Filters = { range: '30d', topic: '', outcome: '', sent: '', flagged: false, q: '' }

/** Filters live in the URL so views can be bookmarked and shared, and survive switching pages. */
export function useFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo<Filters>(() => {
    const range = params.get('range')
    return {
      range: RANGES.some((r) => r.key === range) ? (range as RangeKey) : DEFAULTS.range,
      topic: params.get('topic') ?? '',
      outcome: params.get('outcome') ?? '',
      sent: params.get('sent') ?? '',
      flagged: params.get('flagged') === '1',
      q: params.get('q') ?? '',
    }
  }, [params])

  const update = useCallback(
    (patch: Partial<Filters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(patch)) {
            const isDefault = v === DEFAULTS[k as keyof Filters] || v === '' || v === false
            if (isDefault) next.delete(k)
            else next.set(k, v === true ? '1' : String(v))
          }
          next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const activeCount = [filters.topic, filters.outcome, filters.sent, filters.flagged, filters.q].filter(Boolean).length
  return { filters, update, activeCount, params }
}

const DAY = 86_400_000

/**
 * The dataset is historical, so "last N days" is anchored to the most recent call
 * in the data rather than to today.
 */
export function rangeBounds(range: RangeKey, meta: Meta) {
  const end = new Date(meta.to)
  end.setUTCHours(24, 0, 0, 0)
  const days = RANGES.find((r) => r.key === range)!.days
  if (!days) return { start: new Date(meta.from).getTime() - 1, end: end.getTime(), prevStart: null }
  const start = end.getTime() - days * DAY
  const prevStart = start - days * DAY
  // Only compare against the previous period when the data fully covers it.
  const dataStart = new Date(meta.from)
  dataStart.setUTCHours(0, 0, 0, 0)
  return { start, end: end.getTime(), prevStart: prevStart >= dataStart.getTime() ? prevStart : null }
}

export function matches(c: Call, f: Filters) {
  if (f.topic && c.topic !== f.topic) return false
  if (f.outcome && c.outcome !== f.outcome) return false
  if (f.sent && c.sent !== f.sent) return false
  if (f.flagged && c.flags.length === 0) return false
  if (f.q) {
    const q = f.q.toLowerCase()
    const hay = `${c.id} ${c.reason} ${c.customer ?? ''} ${c.agent ?? ''} ${c.topic}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  return true
}

/** Calls in the selected range, plus the equal-length period before it (for deltas). */
export function applyFilters(calls: Call[], meta: Meta, f: Filters) {
  const { start, end, prevStart } = rangeBounds(f.range, meta)
  const current: Call[] = []
  const previous: Call[] = []
  for (const c of calls) {
    if (!matches(c, f)) continue
    const t = Date.parse(c.start)
    if (t >= start && t < end) current.push(c)
    else if (prevStart !== null && t >= prevStart && t < start) previous.push(c)
  }
  return { current, previous: prevStart === null ? null : previous, start, end }
}

export const SORTS = {
  start: (a: Call, b: Call) => a.start.localeCompare(b.start),
  dur: (a: Call, b: Call) => a.dur - b.dur,
  sEnd: (a: Call, b: Call) => a.sEnd - b.sEnd,
  turns: (a: Call, b: Call) => a.turns - b.turns,
} as const
export type SortKey = keyof typeof SORTS

/** "-start" = newest first (default). */
export function parseSort(raw: string | null): { key: SortKey; desc: boolean } {
  const desc = !raw || raw.startsWith('-')
  const key = (raw ?? '-start').replace(/^-/, '')
  return key in SORTS ? { key: key as SortKey, desc } : { key: 'start', desc: true }
}

export function sortCalls(calls: Call[], sort: { key: SortKey; desc: boolean }) {
  const cmp = SORTS[sort.key]
  return [...calls].sort((a, b) => (sort.desc ? cmp(b, a) : cmp(a, b)) || b.start.localeCompare(a.start))
}
