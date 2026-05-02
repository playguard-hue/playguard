import { store } from './store'
import type { StressEvent } from './stressMonitor'

const API_BASE = 'https://api.playguard.net'

class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'UnauthorizedError'
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const auth = store.get('auth')
  if (!auth.token) {
    throw new UnauthorizedError()
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  })

  if (res.status === 401) {
    store.set('auth', { token: null, user: null })
    throw new UnauthorizedError()
  }

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Request failed')
  }

  return data as T
}

export interface BackendSession {
  id: string
  user_id: string
  game: string
  duration_seconds: number
  started_at: string
  ended_at: string
  created_at: string
  stress_events: StressEvent[]
}

export interface BackendStats {
  total_sessions: number
  total_seconds: number
  avg_seconds: number
  today_seconds: number
}

export const api = {
  async postSession(s: {
    game: string
    duration_seconds: number
    started_at: string
    ended_at: string
    stress_events?: StressEvent[]
  }): Promise<BackendSession> {
    return request<BackendSession>('/sessions', { method: 'POST', body: s })
  },

  async getSessions(): Promise<BackendSession[]> {
    return request<BackendSession[]>('/sessions')
  },

  async getStats(): Promise<BackendStats> {
    return request<BackendStats>('/stats')
  }
}

export { UnauthorizedError }