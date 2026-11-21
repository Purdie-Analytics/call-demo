import { useEffect, useRef, useState } from 'react'
import { RANGES, type Filters } from '../lib/filters'
import { OUTCOMES } from '../lib/metrics'
import { Icon } from './ui'

export function FilterBar({
  filters,
  update,
  topics,
  activeCount,
  showSearch,
}: {
  filters: Filters
  update: (patch: Partial<Filters>) => void
  topics: string[]
  activeCount: number
  showSearch?: boolean
}) {
  // Debounce the search box so typing doesn't re-filter 9k rows on every key.
  const [q, setQ] = useState(filters.q)
  const pushed = useRef(filters.q)
  // Only adopt the URL value when it changed from outside (back button, "Clear filters").
  useEffect(() => {
    if (filters.q !== pushed.current) {
      pushed.current = filters.q
      setQ(filters.q)
    }
  }, [filters.q])
  useEffect(() => {
    if (q === pushed.current) return
    const t = setTimeout(() => {
      pushed.current = q
      update({ q })
    }, 200)
    return () => clearTimeout(t)
  }, [q, update])

  return (
    <div className="filterbar" role="search">
      <div className="segmented" role="group" aria-label="Date range">
        {RANGES.map((r) => (
          <button key={r.key} aria-pressed={filters.range === r.key} onClick={() => update({ range: r.key })}>
            {r.label}
          </button>
        ))}
      </div>
      <select
        className={`select${filters.topic ? ' on' : ''}`}
        value={filters.topic}
        onChange={(e) => update({ topic: e.target.value })}
        aria-label="Topic"
      >
        <option value="">All topics</option>
        {topics.map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <select
        className={`select${filters.outcome ? ' on' : ''}`}
        value={filters.outcome}
        onChange={(e) => update({ outcome: e.target.value })}
        aria-label="Outcome"
      >
        <option value="">All outcomes</option>
        {OUTCOMES.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      <select
        className={`select${filters.sent ? ' on' : ''}`}
        value={filters.sent}
        onChange={(e) => update({ sent: e.target.value })}
        aria-label="Caller sentiment"
      >
        <option value="">Any sentiment</option>
        <option value="positive">Positive</option>
        <option value="neutral">Neutral</option>
        <option value="negative">Negative</option>
      </select>
      <label className={`check${filters.flagged ? ' on' : ''}`}>
        <input type="checkbox" checked={filters.flagged} onChange={(e) => update({ flagged: e.target.checked })} />
        Flagged only
      </label>
      {showSearch && (
        <input
          className="input"
          type="search"
          placeholder="Search caller, agent, reason or call ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search calls"
        />
      )}
      {activeCount > 0 && (
        <button
          className="btn ghost"
          onClick={() => {
            setQ('')
            update({ topic: '', outcome: '', sent: '', flagged: false, q: '' })
          }}
        >
          <Icon name="x" size={14} /> Clear filters
        </button>
      )}
    </div>
  )
}
