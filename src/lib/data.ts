import { useEffect, useState } from 'react'
import type { Call, Meta, Turn } from './types'

const BASE = import.meta.env.BASE_URL

let callsPromise: Promise<{ meta: Meta; calls: Call[] }> | null = null
const shardCache = new Map<string, Promise<Record<string, Turn[]>>>()

function loadCalls() {
  callsPromise ??= fetch(`${BASE}data/calls.json`).then((r) => {
    if (!r.ok) throw new Error(`Could not load calls (${r.status})`)
    return r.json()
  })
  return callsPromise
}

function loadShard(key: string) {
  let p = shardCache.get(key)
  if (!p) {
    p = fetch(`${BASE}data/transcripts/${key}.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load transcript (${r.status})`)
      return r.json()
    })
    shardCache.set(key, p)
  }
  return p
}

type Async<T> = { data: T | null; error: string | null }

export function useCalls(): Async<{ meta: Meta; calls: Call[] }> {
  const [state, setState] = useState<Async<{ meta: Meta; calls: Call[] }>>({ data: null, error: null })
  useEffect(() => {
    let live = true
    loadCalls()
      .then((data) => live && setState({ data, error: null }))
      .catch((e: Error) => live && setState({ data: null, error: e.message }))
    return () => {
      live = false
    }
  }, [])
  return state
}

export function useTranscript(id: string | undefined): Async<Turn[]> {
  const [state, setState] = useState<Async<Turn[]> & { id?: string }>({ data: null, error: null })
  useEffect(() => {
    if (!id) return
    let live = true
    loadShard(id.slice(0, 2))
      .then((shard) => {
        if (!live) return
        const turns = shard[id]
        setState(turns ? { id, data: turns, error: null } : { id, data: null, error: 'Transcript not found' })
      })
      .catch((e: Error) => live && setState({ id, data: null, error: e.message }))
    return () => {
      live = false
    }
  }, [id])
  // Don't show the previous call's transcript while the next one loads.
  return state.id === id ? state : { data: null, error: null }
}
