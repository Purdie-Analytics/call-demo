import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useData } from '../lib/context'
import { SentimentArc } from '../components/charts'
import { Icon, Mood, OutcomePill } from '../components/ui'
import { useTranscript } from '../lib/data'
import { applyFilters, parseSort, sortCalls, useFilters } from '../lib/filters'
import { fmtClock, fmtDuration, fmtLong, fmtPct } from '../lib/format'
import { OUTCOME_HELP } from '../lib/metrics'

export default function CallDetail() {
  const { id } = useParams()
  const { meta, calls } = useData()
  const { filters } = useFilters()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const call = calls.find((c) => c.id === id)
  const { data: turns, error } = useTranscript(call?.id)
  const [hl, setHl] = useState<{ id: string; i: number } | null>(null)
  const highlight = hl && hl.id === id ? hl.i : null
  const turnRefs = useRef<(HTMLDivElement | null)[]>([])
  const qs = params.toString() ? `?${params}` : ''

  // Prev/next walk the same filtered, sorted list the user came from.
  const sortRaw = params.get('sort')
  const { prev, next, pos, total } = useMemo(() => {
    const list = sortCalls(applyFilters(calls, meta, filters).current, parseSort(sortRaw))
    const i = list.findIndex((c) => c.id === id)
    return {
      prev: i > 0 ? list[i - 1] : null,
      next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
      pos: i,
      total: list.length,
    }
  }, [calls, meta, filters, sortRaw, id])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      if (e.key === 'ArrowLeft' && prev) navigate(`/calls/${prev.id}${qs}`)
      if (e.key === 'ArrowRight' && next) navigate(`/calls/${next.id}${qs}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, qs, navigate])

  const jumpTo = (i: number) => {
    if (id) setHl({ id, i })
    turnRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  if (!call) {
    return (
      <div className="empty">
        Call “{id}” wasn’t found. <Link to={`/calls${qs}`}>Back to calls</Link>
      </div>
    )
  }

  const agentName = call.agent ? `${call.agent} (AI)` : 'AI agent'
  const callerName = call.customer ?? 'Caller'

  return (
    <>
      <div className="crumbs">
        <Link to={`/calls${qs}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="back" size={14} /> All calls
        </Link>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          {pos >= 0 && (
            <span className="num" style={{ color: 'var(--muted)' }}>
              {pos + 1} of {total}
            </span>
          )}
          <button className="btn" disabled={!prev} onClick={() => prev && navigate(`/calls/${prev.id}${qs}`)} title="Previous call (←)">
            <Icon name="back" size={14} />
          </button>
          <button className="btn" disabled={!next} onClick={() => next && navigate(`/calls/${next.id}${qs}`)} title="Next call (→)">
            <Icon name="next" size={14} />
          </button>
        </span>
      </div>

      <header className="page-head">
        <div>
          <h1>
            {callerName} · {call.topic}
          </h1>
          <p>
            {fmtLong(call.start)} · Call <span className="num">{call.id}</span>
          </p>
        </div>
        <OutcomePill outcome={call.outcome} />
      </header>

      <div className="detail">
        <div>
          <div className="mini-kpis">
            <div className="card tile">
              <span className="tile-label">Duration</span>
              <span className="tile-value">{fmtDuration(call.dur)}</span>
            </div>
            <div className="card tile">
              <span className="tile-label">Turns</span>
              <span className="tile-value">{call.turns}</span>
            </div>
            <div className="card tile" title="Share of words spoken by the AI agent">
              <span className="tile-label">AI talk share</span>
              <span className="tile-value">{fmtPct(call.agentShare)}</span>
            </div>
            <div className="card tile">
              <span className="tile-label">Caller mood</span>
              <span className="tile-value" style={{ fontSize: 15, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 6 }}>
                <span>
                  <Mood value={call.sStart} />
                </span>
                <span>
                  <span style={{ color: 'var(--muted)' }}>→ </span>
                  <Mood value={call.sEnd} />
                </span>
              </span>
            </div>
          </div>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Transcript</h2>
                <p>
                  {agentName} with {callerName}
                </p>
              </div>
            </div>
            <blockquote className="reason-quote">“{call.reason}”</blockquote>
            {error && <div className="empty">Couldn’t load the transcript: {error}</div>}
            {!turns && !error && <div className="loading">Loading transcript…</div>}
            {turns && (
              <div className="transcript">
                {turns.map((t, i) => (
                  <div
                    key={i}
                    ref={(el) => {
                      turnRefs.current[i] = el
                    }}
                    className={`turn ${t.s}${highlight === i ? ' hl' : ''}`}
                  >
                    <span className="time num">{fmtClock(t.t)}</span>
                    <div>
                      <div className="who">
                        <b>{t.s === 'a' ? agentName : callerName}</b>
                        {t.s === 'c' && <Mood value={t.v} />}
                      </div>
                      <div className="bubble">{t.x}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside>
          <section className="card">
            <div className="card-head">
              <h2>Call summary</h2>
            </div>
            <dl className="facts">
              <dt>Outcome</dt>
              <dd>
                <OutcomePill outcome={call.outcome} />
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>{OUTCOME_HELP[call.outcome]}</div>
              </dd>
              <dt>Topic</dt>
              <dd>{call.topic}</dd>
              <dt>Caller</dt>
              <dd>{call.customer ?? 'Unknown'}</dd>
              <dt>AI agent</dt>
              <dd>{call.agent ? `${call.agent} persona` : 'Default persona'}</dd>
              <dt>Overall mood</dt>
              <dd>
                <Mood value={call.sAvg} showScore />
              </dd>
              <dt>Flags</dt>
              <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {call.flags.length ? (
                  call.flags.map((f) => (
                    <span key={f} className="tag warn">
                      {f}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--muted)' }}>None</span>
                )}
              </dd>
            </dl>
          </section>

          <section className="card">
            <div className="card-head">
              <div>
                <h2>Caller sentiment through the call</h2>
                <p>Each dot is a caller turn. Click one to jump to it.</p>
              </div>
            </div>
            {turns ? <SentimentArc turns={turns} onPick={jumpTo} /> : <div className="loading">…</div>}
          </section>
        </aside>
      </div>
    </>
  )
}
