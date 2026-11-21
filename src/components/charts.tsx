import { useState, type CSSProperties } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Bucket, TopicRow } from '../lib/metrics'
import { OUTCOME_HELP, outcomeMix, sentimentShift } from '../lib/metrics'
import { fmtClock, fmtDuration, fmtInt, fmtPct, fmtScore } from '../lib/format'
import type { Outcome, Turn } from '../lib/types'
import { TipBox } from './ui'
import { OUTCOME_COLOR, OUTCOME_DARK_TEXT, SENT_COLOR, SENT_LABEL, SENT_ORDER } from '../lib/colors'

const AXIS = { fontSize: 11.5, fill: 'var(--muted)' }

/* ---------------- Call volume (single series columns) ---------------- */

export function VolumeChart({ data, unit }: { data: Bucket[]; unit: 'day' | 'week' }) {
  return (
    <ResponsiveContainer width="100%" height={330}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: 'var(--axis)' }}
          minTickGap={16}
          interval="preserveStartEnd"
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
        <Tooltip
          cursor={{ fill: 'var(--hover)' }}
          content={({ active, payload }) => {
            const b = payload?.[0]?.payload as Bucket | undefined
            if (!active || !b) return null
            return (
              <TipBox
                title={unit === 'week' ? `Week of ${b.label}` : b.label}
                rows={[
                  ['Calls', fmtInt(b.calls)],
                  ['Contained', b.resolution === null ? '–' : fmtPct(b.resolution)],
                  ['Avg handle time', b.avgDur === null ? '–' : fmtDuration(b.avgDur)],
                ]}
              />
            )
          }}
        />
        <Bar dataKey="calls" fill="var(--series)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ---------------- Containment rate over time (single line) ---------------- */

export function RateChart({ data, unit }: { data: Bucket[]; unit: 'day' | 'week' }) {
  const vals = data.map((d) => d.resolution).filter((v): v is number => v !== null)
  const lo = Math.max(0, Math.floor((Math.min(...vals, 1) - 0.05) * 10) / 10)
  const hi = Math.min(1, Math.ceil((Math.max(...vals, 0) + 0.05) * 10) / 10)
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="label"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: 'var(--axis)' }}
          minTickGap={16}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          domain={[lo, hi]}
          tickFormatter={(v: number) => fmtPct(v)}
          width={48}
        />
        <Tooltip
          cursor={{ stroke: 'var(--axis)' }}
          content={({ active, payload }) => {
            const b = payload?.[0]?.payload as Bucket | undefined
            if (!active || !b) return null
            return (
              <TipBox
                title={unit === 'week' ? `Week of ${b.label}` : b.label}
                rows={[
                  ['Contained', b.resolution === null ? '–' : fmtPct(b.resolution, 1)],
                  ['Calls', fmtInt(b.calls)],
                ]}
              />
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="resolution"
          stroke="var(--series)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--series)' }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/* ---------------- Floating tooltip for HTML charts ---------------- */

function useFloatTip() {
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null)
  const bind = (node: React.ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, node }),
    onMouseLeave: () => setTip(null),
  })
  const el = tip ? (
    <div
      className="float-tip"
      style={{
        left: Math.min(tip.x + 14, window.innerWidth - 220),
        top: tip.y + 14,
      }}
    >
      {tip.node}
    </div>
  ) : null
  return { bind, el }
}

/* ---------------- Outcome mix (tall segmented bar + list) ---------------- */

export function OutcomeMix({
  mix,
  onPick,
}: {
  mix: ReturnType<typeof outcomeMix>
  onPick?: (o: Outcome) => void
}) {
  const { bind, el } = useFloatTip()
  return (
    <div>
      <div className="segbar" role="img" aria-label={mix.map((m) => `${m.outcome} ${fmtPct(m.share)}`).join(', ')}>
        {mix
          .filter((m) => m.count > 0)
          .map((m) => (
            <div
              key={m.outcome}
              className={OUTCOME_DARK_TEXT[m.outcome] ? 'dark-text' : ''}
              style={{ flex: `${m.share} 1 0`, background: OUTCOME_COLOR[m.outcome] }}
              {...bind(
                <TipBox
                  title={m.outcome}
                  rows={[
                    ['Calls', fmtInt(m.count)],
                    ['Share', fmtPct(m.share, 1)],
                  ]}
                />,
              )}
            >
              {/* Only print the share where it fits comfortably */}
              {m.share >= 0.09 ? fmtPct(m.share) : ''}
            </div>
          ))}
      </div>
      <div className="outcome-list">
        {mix.map((m) => (
          <button
            key={m.outcome}
            onClick={() => onPick?.(m.outcome)}
            title={`Show ${m.outcome.toLowerCase()} calls`}
            disabled={!onPick}
          >
            <span className="name">
              <i className="swatch" style={{ background: OUTCOME_COLOR[m.outcome] }} />
              <span>
                {m.outcome}
                <span className="help">{OUTCOME_HELP[m.outcome]}</span>
              </span>
            </span>
            <span className="num" style={{ textAlign: 'right' }}>
              {fmtInt(m.count)}
            </span>
            <span className="num" style={{ textAlign: 'right', color: 'var(--muted)', minWidth: 44 }}>
              {fmtPct(m.share, 1)}
            </span>
          </button>
        ))}
      </div>
      {el}
    </div>
  )
}

/* ---------------- Sentiment start vs end (100% bars, diverging) ---------------- */

export function SentimentShiftChart({ rows }: { rows: ReturnType<typeof sentimentShift> }) {
  const { bind, el } = useFloatTip()
  return (
    <div>
      {rows.map((r) => (
        <div key={r.stage} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
            <span>{r.stage}</span>
            <span style={{ color: 'var(--muted)' }}>{fmtPct(r.positive)} positive</span>
          </div>
          <div className="segbar" style={{ margin: '4px 0 0' }}>
            {SENT_ORDER.map((k) =>
              r[k] > 0 ? (
                <div
                  key={k}
                  className={k === 'neutral' ? 'dark-text' : ''}
                  style={{
                    flex: `${r[k]} 1 0`,
                    background: SENT_COLOR[k],
                    color: k === 'neutral' ? 'var(--ink)' : '#fff',
                  }}
                  {...bind(<TipBox title={`${r.stage} · ${SENT_LABEL[k]}`} rows={[['Share of callers', fmtPct(r[k], 1)]]} />)}
                >
                  {r[k] >= 0.1 ? fmtPct(r[k]) : ''}
                </div>
              ) : null,
            )}
          </div>
        </div>
      ))}
      {el}
    </div>
  )
}

export function SentimentLegend() {
  return (
    <div className="legend">
      {SENT_ORDER.map((k) => (
        <span key={k}>
          <i className="swatch" style={{ background: SENT_COLOR[k] }} />
          {SENT_LABEL[k]}
        </span>
      ))}
    </div>
  )
}

/* ---------------- Topic table with inline bars ---------------- */

export function TopicTable({ rows, onPick }: { rows: TopicRow[]; onPick: (topic: string) => void }) {
  const max = Math.max(...rows.map((r) => r.calls), 1)
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Topic</th>
            <th style={{ width: '32%' }}>Calls</th>
            <th className="r">Contained</th>
            <th className="r">Escalated</th>
            <th className="r">Avg handle time</th>
            <th className="r">Upset at start</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.topic}
              className="clickable"
              tabIndex={0}
              onClick={() => onPick(r.topic)}
              onKeyDown={(e) => e.key === 'Enter' && onPick(r.topic)}
              title={`Show ${r.topic} calls`}
            >
              <td>{r.topic}</td>
              <td>
                <div className="inline-bar">
                  <div className="track">
                    <div className="fill" style={{ width: `${(r.calls / max) * 100}%` }} />
                  </div>
                  <span className="num" style={{ minWidth: 56, textAlign: 'right' }}>
                    {fmtInt(r.calls)}
                  </span>
                </div>
              </td>
              <td className="r num">{fmtPct(r.resolution)}</td>
              <td className="r num">{fmtPct(r.escalation)}</td>
              <td className="r num">{fmtDuration(r.avgDur)}</td>
              <td className="r num">{fmtPct(r.negative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------- Day x hour heatmap (sequential blue) ---------------- */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const STEPS = ['--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6']

export function HourHeatmap({ grid }: { grid: number[][] }) {
  const { bind, el } = useFloatTip()
  const max = Math.max(...grid.flat(), 1)
  const color = (v: number): CSSProperties['background'] =>
    v === 0 ? 'var(--seq-0)' : `var(${STEPS[Math.min(STEPS.length - 1, Math.floor((v / max) * STEPS.length))]})`
  return (
    <div>
      <div className="heat" role="img" aria-label="Calls by weekday and hour (UTC)">
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="collabel">
            {h % 6 === 0 ? `${h}h` : ''}
          </span>
        ))}
        {grid.map((row, d) => (
          <Row key={d} label={DAYS[d]}>
            {row.map((v, h) => (
              <div
                key={h}
                className="cell"
                style={{ background: color(v) }}
                {...bind(
                  <TipBox
                    title={`${DAYS[d]} ${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59 UTC`}
                    rows={[['Calls', fmtInt(v)]]}
                  />,
                )}
              />
            ))}
          </Row>
        ))}
      </div>
      <div className="ramp">
        Fewer
        <i style={{ background: 'var(--seq-0)' }} />
        {STEPS.map((s) => (
          <i key={s} style={{ background: `var(${s})` }} />
        ))}
        More · peak {fmtInt(max)} calls/hour
      </div>
      {el}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="rowlabel">{label}</span>
      {children}
    </>
  )
}

/* ---------------- Sentiment arc for a single call ---------------- */

export function SentimentArc({ turns, onPick }: { turns: Turn[]; onPick?: (index: number) => void }) {
  const data = turns.map((t, i) => ({ ...t, i })).filter((t) => t.s === 'c')
  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart
        data={data}
        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
        onClick={(s) => {
          const idx = s?.activeTooltipIndex
          if (onPick && typeof idx === 'number' && data[idx]) onPick(data[idx].i)
        }}
      >
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="t"
          tick={AXIS}
          tickLine={false}
          axisLine={{ stroke: 'var(--axis)' }}
          tickFormatter={(v: number) => fmtClock(v)}
          minTickGap={24}
        />
        <YAxis
          domain={[-1, 1]}
          ticks={[-1, 0, 1]}
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v === 1 ? 'Pos' : v === -1 ? 'Neg' : '0')}
        />
        <ReferenceLine y={0} stroke="var(--axis)" />
        <Tooltip
          cursor={{ stroke: 'var(--axis)' }}
          content={({ active, payload }) => {
            const t = payload?.[0]?.payload as (Turn & { i: number }) | undefined
            if (!active || !t) return null
            return (
              <div className="tip" style={{ maxWidth: 280 }}>
                <div className="tip-title">
                  Caller at {fmtClock(t.t)} · score {fmtScore(t.v)}
                </div>
                <div>{t.x.length > 140 ? `${t.x.slice(0, 140)}…` : t.x}</div>
              </div>
            )
          }}
        />
        <Line
          type="monotone"
          dataKey="v"
          stroke="var(--series)"
          strokeWidth={2}
          dot={{ r: 4, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--series)' }}
          activeDot={{ r: 6, stroke: 'var(--surface)', strokeWidth: 2, fill: 'var(--series)', cursor: 'pointer' }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
