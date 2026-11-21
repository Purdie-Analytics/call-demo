const nf = new Intl.NumberFormat('en-US')
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })

export const fmtInt = (n: number) => nf.format(Math.round(n))
export const fmtCompact = (n: number) => (Math.abs(n) < 10_000 ? nf.format(Math.round(n)) : compact.format(n))
export const fmtPct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`

/** 135 -> "2m 15s" */
export function fmtDuration(sec: number) {
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m ? `${m}m ${String(r).padStart(2, '0')}s` : `${r}s`
}

/** 75.4 -> "1:15" (transcript offsets) */
export function fmtClock(sec: number) {
  const s = Math.floor(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// Timestamps in the dataset are UTC; show them in UTC so every viewer sees the same thing.
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const dateTimeFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
})
const longFmt = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
})
const dayFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso))
export const fmtDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))
export const fmtLong = (iso: string) => `${longFmt.format(new Date(iso))} UTC`
export const fmtDay = (iso: string) => dayFmt.format(new Date(iso))

export function fmtScore(v: number) {
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}`
}

export function pctDelta(cur: number, prev: number, asPoints: boolean): { text: string; dir: 1 | -1 | 0 } | null {
  if (asPoints) {
    const d = (cur - prev) * 100
    if (Math.abs(d) < 0.05) return { text: '0.0 pts', dir: 0 }
    return { text: `${Math.abs(d).toFixed(1)} pts`, dir: d > 0 ? 1 : -1 }
  }
  if (!prev) return null
  const d = (cur - prev) / prev
  if (Math.abs(d) < 0.0005) return { text: '0%', dir: 0 }
  return { text: `${Math.abs(d * 100).toFixed(1)}%`, dir: d > 0 ? 1 : -1 }
}
