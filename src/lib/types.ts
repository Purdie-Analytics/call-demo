export type Outcome = 'Resolved' | 'Follow-up' | 'Escalated' | 'Unresolved' | 'Retained' | 'Cancelled'
export type Sentiment = 'positive' | 'neutral' | 'negative'

/** One call, as produced by scripts/build_data.py (see calls.json). */
export interface Call {
  id: string
  /** ISO timestamp (UTC) of the first turn */
  start: string
  /** Duration in seconds */
  dur: number
  turns: number
  topic: string
  outcome: Outcome
  /** Overall caller sentiment label */
  sent: Sentiment
  /** VADER compound scores (-1..1) for the caller: average, first two turns, last two turns */
  sAvg: number
  sStart: number
  sEnd: number
  /** Share of words spoken by the AI agent (0..1) */
  agentShare: number
  agent: string | null
  customer: string | null
  /** Caller's opening statement */
  reason: string
  flags: string[]
}

export interface Meta {
  company: string
  source: string
  count: number
  from: string
  to: string
}

export interface Turn {
  /** speaker: a = AI agent, c = caller */
  s: 'a' | 'c'
  /** seconds from call start */
  t: number
  /** text */
  x: string
  /** VADER compound sentiment */
  v: number
}
