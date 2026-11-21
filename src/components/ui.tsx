import { useEffect, useState, type ReactNode } from 'react'
import type { Outcome } from '../lib/types'
import { OUTCOME_COLOR, SENT_COLOR, SENT_LABEL } from '../lib/colors'
import { band } from '../lib/metrics'
import { fmtScore } from '../lib/format'

export function OutcomePill({ outcome }: { outcome: Outcome }) {
  return (
    <span className="pill">
      <i className="dot" style={{ background: OUTCOME_COLOR[outcome] }} aria-hidden />
      {outcome}
    </span>
  )
}

export function Mood({ value, showScore }: { value: number; showScore?: boolean }) {
  const b = band(value)
  return (
    <span className="mood" title={`Sentiment score ${fmtScore(value)}`}>
      <i style={{ background: SENT_COLOR[b] }} aria-hidden />
      {SENT_LABEL[b]}
      {showScore && <span className="num" style={{ color: 'var(--muted)' }}>({fmtScore(value)})</span>}
    </span>
  )
}

export function StatTile({
  label,
  value,
  delta,
  hero,
  hint,
}: {
  label: string
  value: string
  /** current/previous comparison; `upIsGood` decides the colour */
  delta?: { text: string; dir: 1 | -1 | 0; upIsGood: boolean | null; vs: string } | null
  hero?: boolean
  hint?: string
}) {
  let cls = ''
  if (delta && delta.dir !== 0 && delta.upIsGood !== null) cls = (delta.dir === 1) === delta.upIsGood ? 'good' : 'bad'
  return (
    <div className={`card tile${hero ? ' hero' : ''}`} title={hint}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      {delta ? (
        <span className="delta">
          <b className={cls}>
            {delta.dir === 1 ? '▲ ' : delta.dir === -1 ? '▼ ' : ''}
            {delta.text}
          </b>{' '}
          vs {delta.vs}
        </span>
      ) : (
        <span className="delta">&nbsp;</span>
      )}
    </div>
  )
}

/** A chart card with a built-in "Table" toggle, so every chart's values are readable without colour. */
export function ChartCard({
  title,
  subtitle,
  children,
  table,
  legend,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  table?: ReactNode
  legend?: ReactNode
  actions?: ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {actions}
          {table && (
            <button className="btn ghost" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
              {showTable ? 'Chart' : 'Table'}
            </button>
          )}
        </div>
      </div>
      {legend && !showTable && <div style={{ marginBottom: 10 }}>{legend}</div>}
      {showTable ? <div className="table-wrap">{table}</div> : children}
    </section>
  )
}

export function TipBox({ title, rows }: { title: ReactNode; rows: [ReactNode, ReactNode][] }) {
  return (
    <div className="tip">
      <div className="tip-title">{title}</div>
      {rows.map(([k, v], i) => (
        <div className="tip-row" key={i}>
          <span>{k}</span>
          <b className="num">{v}</b>
        </div>
      ))}
    </div>
  )
}

type Theme = 'light' | 'dark' | 'system'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('theme') as Theme) || 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* storage unavailable; theme still applies for this session */
    }
  }, [theme])
  const next: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }
  const label: Record<Theme, string> = { system: 'Auto', light: 'Light', dark: 'Dark' }
  return (
    <button className="btn ghost" onClick={() => setTheme(next[theme])} title="Switch colour theme">
      <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'auto'} />
      Theme: {label[theme]}
    </button>
  )
}

const PATHS: Record<string, ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  phone: (
    <path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />,
  auto: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  next: <path d="M9 18l6-6-6-6" />,
  flag: <path d="M5 21V4h11l-1.5 4L16 12H5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  download: <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3" />,
}

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  )
}
