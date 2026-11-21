import type { Call, Outcome } from './types'

export const OUTCOMES: Outcome[] = ['Resolved', 'Follow-up', 'Escalated', 'Unresolved', 'Retained', 'Cancelled']

export const OUTCOME_HELP: Record<Outcome, string> = {
  Resolved: 'The agent handled the request and the caller signed off',
  'Follow-up': 'A ticket, callback or pending fix was promised',
  Escalated: 'Handed to a human team, technician or store visit',
  Unresolved: 'Caller ended unhappy with no resolution',
  Retained: 'Cancellation request where the caller stayed',
  Cancelled: 'Cancellation request that went through',
}

/** "Contained" = the AI agent finished the job without handing off to a person. */
const CONTAINED: Outcome[] = ['Resolved', 'Retained']

export const POSITIVE_END = 0.3

export interface Kpis {
  total: number
  avgDur: number
  resolution: number
  escalation: number
  positiveEnd: number
  flagged: number
}

export function kpis(calls: Call[]): Kpis {
  const n = calls.length || 1
  let dur = 0
  let res = 0
  let esc = 0
  let pos = 0
  let flagged = 0
  for (const c of calls) {
    dur += c.dur
    if (CONTAINED.includes(c.outcome)) res++
    if (c.outcome === 'Escalated') esc++
    if (c.sEnd >= POSITIVE_END) pos++
    if (c.flags.length) flagged++
  }
  return {
    total: calls.length,
    avgDur: dur / n,
    resolution: res / n,
    escalation: esc / n,
    positiveEnd: pos / n,
    flagged,
  }
}

const DAY = 86_400_000

export interface Bucket {
  key: number
  label: string
  calls: number
  resolution: number | null
  avgDur: number | null
}

/** Daily buckets for short ranges, weekly for long ones. Empty buckets are kept so gaps show. */
export function timeSeries(calls: Call[], start: number, end: number): { buckets: Bucket[]; unit: 'day' | 'week' } {
  const days = Math.round((end - start) / DAY)
  const unit = days > 45 ? 'week' : 'day'
  const size = unit === 'week' ? 7 * DAY : DAY
  // Align weekly buckets to the range end so the last bucket is a full week.
  const first = unit === 'week' ? end - Math.ceil((end - start) / size) * size : Math.floor(start / DAY) * DAY
  const count = Math.ceil((end - first) / size)
  const acc = Array.from({ length: count }, (_, i) => ({ key: first + i * size, n: 0, res: 0, dur: 0 }))
  for (const c of calls) {
    const i = Math.floor((Date.parse(c.start) - first) / size)
    const b = acc[i]
    if (!b) continue
    b.n++
    b.dur += c.dur
    if (CONTAINED.includes(c.outcome)) b.res++
  }
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return {
    unit,
    buckets: acc.map((b) => ({
      key: b.key,
      label: fmt.format(new Date(b.key)),
      calls: b.n,
      resolution: b.n ? b.res / b.n : null,
      avgDur: b.n ? b.dur / b.n : null,
    })),
  }
}

export function outcomeMix(calls: Call[]) {
  const counts = new Map<Outcome, number>(OUTCOMES.map((o) => [o, 0]))
  for (const c of calls) counts.set(c.outcome, (counts.get(c.outcome) ?? 0) + 1)
  return OUTCOMES.map((o) => ({ outcome: o, count: counts.get(o)!, share: calls.length ? counts.get(o)! / calls.length : 0 }))
}

export interface TopicRow {
  topic: string
  calls: number
  share: number
  resolution: number
  escalation: number
  avgDur: number
  negative: number
}

export function topicTable(calls: Call[]): TopicRow[] {
  const by = new Map<string, Call[]>()
  for (const c of calls) {
    const list = by.get(c.topic)
    if (list) list.push(c)
    else by.set(c.topic, [c])
  }
  return [...by.entries()]
    .map(([topic, list]) => {
      const k = kpis(list)
      return {
        topic,
        calls: list.length,
        share: list.length / (calls.length || 1),
        resolution: k.resolution,
        escalation: k.escalation,
        avgDur: k.avgDur,
        negative: list.filter((c) => c.sent === 'negative' || c.sStart <= -0.05).length / list.length,
      }
    })
    .sort((a, b) => b.calls - a.calls)
}

/** 7 x 24 grid of call counts, Monday first, hours in UTC. */
export function hourGrid(calls: Call[]) {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  for (const c of calls) {
    const d = new Date(c.start)
    grid[(d.getUTCDay() + 6) % 7][d.getUTCHours()]++
  }
  return grid
}

export type Band = 'negative' | 'neutral' | 'positive'
export const band = (v: number): Band => (v >= POSITIVE_END ? 'positive' : v <= -0.05 ? 'negative' : 'neutral')

/** Share of callers in each sentiment band at the start vs the end of the call. */
export function sentimentShift(calls: Call[]) {
  const n = calls.length || 1
  const count = (pick: (c: Call) => number) => {
    const out = { negative: 0, neutral: 0, positive: 0 }
    for (const c of calls) out[band(pick(c))]++
    return { negative: out.negative / n, neutral: out.neutral / n, positive: out.positive / n }
  }
  return [
    { stage: 'Start of call', ...count((c) => c.sStart) },
    { stage: 'End of call', ...count((c) => c.sEnd) },
  ]
}

export function topFlags(calls: Call[]) {
  const counts = new Map<string, number>()
  for (const c of calls) for (const f of c.flags) counts.set(f, (counts.get(f) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}
