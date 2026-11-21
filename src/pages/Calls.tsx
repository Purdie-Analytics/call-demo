import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../lib/context'
import { FilterBar } from '../components/FilterBar'
import { Icon, Mood, OutcomePill } from '../components/ui'
import { applyFilters, parseSort, sortCalls, useFilters, type SortKey } from '../lib/filters'
import { fmtDateTime, fmtDuration, fmtInt } from '../lib/format'
import type { Call } from '../lib/types'

const PAGE_SIZE = 25

export default function CallsPage() {
  const { meta, calls, topics } = useData()
  const { filters, update, activeCount, params } = useFilters()
  const navigate = useNavigate()
  const sortRaw = params.get('sort')
  const sort = parseSort(sortRaw)
  const page = Math.max(1, Number(params.get('page')) || 1)

  const rows = useMemo(
    () => sortCalls(applyFilters(calls, meta, filters).current, parseSort(sortRaw)),
    [calls, meta, filters, sortRaw],
  )
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages)
  const visible = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const setParam = (key: string, value: string | null) => {
    const p = new URLSearchParams(params)
    if (value === null) p.delete(key)
    else p.set(key, value)
    navigate({ search: p.toString() }, { replace: key === 'sort' })
  }

  const toggleSort = (key: SortKey) => {
    const next = sort.key === key ? (sort.desc ? key : `-${key}`) : `-${key}`
    const p = new URLSearchParams(params)
    if (next === '-start') p.delete('sort')
    else p.set('sort', next)
    p.delete('page')
    navigate({ search: p.toString() }, { replace: true })
  }

  const sortHead = (k: SortKey, label: string, right?: boolean) => (
    <th className={right ? 'r' : ''} aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button onClick={() => toggleSort(k)}>
        {label}
        {sort.key === k ? (sort.desc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )

  const open = (c: Call) => navigate({ pathname: `/calls/${c.id}`, search: params.toString() })

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Calls</h1>
          <p>
            {fmtInt(rows.length)} call{rows.length === 1 ? '' : 's'} · click any call for the full transcript and analysis
          </p>
        </div>
        <button className="btn" onClick={() => downloadCsv(rows)} disabled={!rows.length}>
          <Icon name="download" size={14} /> Export CSV
        </button>
      </header>
      <FilterBar filters={filters} update={update} topics={topics} activeCount={activeCount} showSearch />

      <section className="card" style={{ paddingBottom: 8 }}>
        {rows.length === 0 ? (
          <div className="empty">No calls match these filters.</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {sortHead('start', 'When (UTC)')}
                    <th>Caller</th>
                    <th>Topic</th>
                    <th>Reason for call</th>
                    {sortHead('dur', 'Duration', true)}
                    <th>Outcome</th>
                    {sortHead('sEnd', 'Mood at end')}
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr
                      key={c.id}
                      className="clickable"
                      tabIndex={0}
                      onClick={() => open(c)}
                      onKeyDown={(e) => e.key === 'Enter' && open(c)}
                    >
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        {fmtDateTime(c.start)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{c.customer ?? <span style={{ color: 'var(--muted)' }}>Unknown</span>}</td>
                      <td>
                        <span className="tag">{c.topic}</span>
                      </td>
                      <td>
                        <div className="reason" title={c.reason}>
                          {c.reason}
                        </div>
                      </td>
                      <td className="r num">{fmtDuration(c.dur)}</td>
                      <td>
                        <OutcomePill outcome={c.outcome} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Mood value={c.sEnd} />
                      </td>
                      <td>
                        {c.flags.length > 0 && (
                          <span className="tag warn" title={c.flags.join(', ')}>
                            <Icon name="flag" size={12} /> {c.flags.length === 1 ? c.flags[0] : `${c.flags.length} flags`}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pager">
              <span className="num">
                {fmtInt((current - 1) * PAGE_SIZE + 1)}–{fmtInt(Math.min(current * PAGE_SIZE, rows.length))} of{' '}
                {fmtInt(rows.length)}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn" disabled={current <= 1} onClick={() => setParam('page', current - 1 === 1 ? null : String(current - 1))}>
                  <Icon name="back" size={14} /> Prev
                </button>
                <span className="num">
                  Page {current} of {fmtInt(pages)}
                </span>
                <button className="btn" disabled={current >= pages} onClick={() => setParam('page', String(current + 1))}>
                  Next <Icon name="next" size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  )
}

function downloadCsv(rows: Call[]) {
  const cols: [string, (c: Call) => string | number][] = [
    ['call_id', (c) => c.id],
    ['start_utc', (c) => c.start],
    ['duration_sec', (c) => c.dur],
    ['turns', (c) => c.turns],
    ['caller', (c) => c.customer ?? ''],
    ['agent_persona', (c) => c.agent ?? ''],
    ['topic', (c) => c.topic],
    ['outcome', (c) => c.outcome],
    ['sentiment', (c) => c.sent],
    ['sentiment_start', (c) => c.sStart],
    ['sentiment_end', (c) => c.sEnd],
    ['agent_talk_share', (c) => c.agentShare],
    ['flags', (c) => c.flags.join('; ')],
    ['reason', (c) => c.reason],
  ]
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.map(([h]) => h).join(','), ...rows.map((r) => cols.map(([, f]) => esc(f(r))).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `calls-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
