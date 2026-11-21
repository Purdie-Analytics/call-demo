import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../lib/context'
import { FilterBar } from '../components/FilterBar'
import {
  HourHeatmap,
  OutcomeMix,
  RateChart,
  SentimentLegend,
  SentimentShiftChart,
  TopicTable,
  VolumeChart,
} from '../components/charts'
import { ChartCard, StatTile } from '../components/ui'
import { applyFilters, RANGES, useFilters } from '../lib/filters'
import { fmtCompact, fmtDate, fmtDuration, fmtInt, fmtPct, pctDelta } from '../lib/format'
import { hourGrid, kpis, outcomeMix, sentimentShift, timeSeries, topFlags, topicTable } from '../lib/metrics'

export default function Overview() {
  const { meta, calls, topics } = useData()
  const { filters, update, activeCount } = useFilters()
  const navigate = useNavigate()

  const view = useMemo(() => {
    const { current, previous, start, end } = applyFilters(calls, meta, filters)
    return {
      current,
      start,
      end,
      k: kpis(current),
      prev: previous && previous.length ? kpis(previous) : null,
      series: timeSeries(current, start, end),
      mix: outcomeMix(current),
      topics: topicTable(current),
      grid: hourGrid(current),
      shift: sentimentShift(current),
      flags: topFlags(current),
    }
  }, [calls, meta, filters])

  const rangeLabel = RANGES.find((r) => r.key === filters.range)!
  const vs = filters.range === 'all' ? '' : `previous ${rangeLabel.days} days`
  const { k, prev } = view

  const drill = (patch: Record<string, string>) => {
    const p = new URLSearchParams(window.location.search)
    for (const [key, v] of Object.entries(patch)) p.set(key, String(v))
    navigate(`/calls?${p}`)
  }

  const delta = (cur: number, before: number | undefined, points: boolean, upIsGood: boolean | null) => {
    if (!prev || before === undefined) return null
    const d = pctDelta(cur, before, points)
    return d ? { ...d, upIsGood, vs } : null
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <p>
            {fmtDate(new Date(view.start + 1).toISOString())} – {fmtDate(new Date(view.end - 1).toISOString())} ·
            how your AI agent handled inbound calls
          </p>
        </div>
      </header>
      <FilterBar filters={filters} update={update} topics={topics} activeCount={activeCount} />

      {k.total === 0 ? (
        <div className="card empty">No calls match these filters.</div>
      ) : (
        <>
          <div className="grid kpis">
            <StatTile hero label="Calls handled" value={fmtCompact(k.total)} delta={delta(k.total, prev?.total, false, null)} />
            <StatTile
              label="Contained by AI"
              hint="Resolved or retained on the call with no hand-off to a person"
              value={fmtPct(k.resolution, 1)}
              delta={delta(k.resolution, prev?.resolution, true, true)}
            />
            <StatTile
              label="Escalation rate"
              hint="Share of calls handed to a human team, technician or store"
              value={fmtPct(k.escalation, 1)}
              delta={delta(k.escalation, prev?.escalation, true, false)}
            />
            <StatTile
              label="Avg handle time"
              value={fmtDuration(k.avgDur)}
              delta={delta(k.avgDur, prev?.avgDur, false, false)}
            />
            <StatTile
              label="Callers ending positive"
              hint="Caller sentiment in their last two turns"
              value={fmtPct(k.positiveEnd, 1)}
              delta={delta(k.positiveEnd, prev?.positiveEnd, true, true)}
            />
          </div>

          <div className="grid two">
            <ChartCard
              title="Call volume"
              subtitle={`Calls per ${view.series.unit}`}
              table={
                <table>
                  <thead>
                    <tr>
                      <th>{view.series.unit === 'week' ? 'Week of' : 'Day'}</th>
                      <th className="r">Calls</th>
                      <th className="r">Contained</th>
                      <th className="r">Avg handle time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.series.buckets.map((b) => (
                      <tr key={b.key}>
                        <td>{b.label}</td>
                        <td className="r num">{fmtInt(b.calls)}</td>
                        <td className="r num">{b.resolution === null ? '–' : fmtPct(b.resolution, 1)}</td>
                        <td className="r num">{b.avgDur === null ? '–' : fmtDuration(b.avgDur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <VolumeChart data={view.series.buckets} unit={view.series.unit} />
            </ChartCard>
            <ChartCard title="Call outcomes" subtitle="Click an outcome to see those calls">
              <OutcomeMix mix={view.mix} onPick={(o) => drill({ outcome: o })} />
            </ChartCard>
          </div>

          <div className="grid halves">
            <ChartCard
              title="Containment rate"
              subtitle={`Share of calls the AI agent finished on its own, per ${view.series.unit}`}
            >
              <RateChart data={view.series.buckets} unit={view.series.unit} />
            </ChartCard>
            <ChartCard
              title="Caller sentiment, start vs end"
              subtitle="How callers sounded in their first two turns compared with their last two"
              legend={<SentimentLegend />}
              table={
                <table>
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th className="r">Negative</th>
                      <th className="r">Neutral</th>
                      <th className="r">Positive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.shift.map((r) => (
                      <tr key={r.stage}>
                        <td>{r.stage}</td>
                        <td className="r num">{fmtPct(r.negative, 1)}</td>
                        <td className="r num">{fmtPct(r.neutral, 1)}</td>
                        <td className="r num">{fmtPct(r.positive, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <SentimentShiftChart rows={view.shift} />
              {view.flags.length > 0 && (
                <div style={{ borderTop: '1px solid var(--grid)', paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--ink-2)' }}>Calls flagged for attention</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {view.flags.map(([f, n]) => (
                      <span key={f} className="tag warn">
                        {f} · <b className="num">{fmtInt(n)}</b>
                      </span>
                    ))}
                    <button className="btn ghost" onClick={() => drill({ flagged: '1' })}>
                      Review {fmtInt(k.flagged)} flagged calls →
                    </button>
                  </div>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="grid" style={{ marginBottom: 16 }}>
            <ChartCard title="Topics" subtitle="What callers asked about, and how well the AI agent handled each. Click a row to see those calls.">
              <TopicTable rows={view.topics} onPick={(t) => drill({ topic: t })} />
            </ChartCard>
          </div>

          <div className="grid">
            <ChartCard
              title="When calls come in"
              subtitle="Calls by weekday and hour (UTC)"
              table={
                <table>
                  <thead>
                    <tr>
                      <th>Hour (UTC)</th>
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                        <th key={d} className="r">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 24 }, (_, h) => (
                      <tr key={h}>
                        <td>{String(h).padStart(2, '0')}:00</td>
                        {view.grid.map((row, d) => (
                          <td key={d} className="r num">
                            {row[h]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            >
              <HourHeatmap grid={view.grid} />
            </ChartCard>
          </div>
        </>
      )}

      <p className="note">
        Demo data: {fmtInt(meta.count)} synthetic telecom support calls from the Talkmap telecom conversation corpus (MIT
        licence). The dataset has no labels, so topic, outcome, sentiment and flags are estimated from the transcripts
        by keyword rules and the VADER sentiment model. Date ranges count back from the latest call in the data (
        {fmtDate(meta.to)}).
      </p>
    </>
  )
}
