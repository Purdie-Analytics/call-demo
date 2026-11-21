import type { Outcome, Sentiment } from './types'

export const OUTCOME_COLOR: Record<Outcome, string> = {
  Resolved: 'var(--o-resolved)',
  'Follow-up': 'var(--o-followup)',
  Escalated: 'var(--o-escalated)',
  Unresolved: 'var(--o-unresolved)',
  Retained: 'var(--o-retained)',
  Cancelled: 'var(--o-cancelled)',
}
/** Labels printed inside a fill: near-black on yellow, white elsewhere. */
export const OUTCOME_DARK_TEXT: Partial<Record<Outcome, boolean>> = { 'Follow-up': true }

export const SENT_COLOR: Record<Sentiment, string> = {
  negative: 'var(--s-negative)',
  neutral: 'var(--s-neutral)',
  positive: 'var(--s-positive)',
}
export const SENT_LABEL: Record<Sentiment, string> = { negative: 'Negative', neutral: 'Neutral', positive: 'Positive' }

export const SENT_ORDER = ['negative', 'neutral', 'positive'] as const
