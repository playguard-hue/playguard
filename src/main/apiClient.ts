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

export interface LeaderboardEntry {
  username: string
  total_xp: number
  current_level: number
  achievements_count: number
}

export interface Challenge {
  id: string
  title: string
  description: string
  type: string
  goal_type: string
  goal_value: number
  duration_days: number
  xp_reward: number
  emoji: string
  user_challenge_id: string | null
  expires_at: string | null
  current_progress: number | null
  completed: boolean | null
}

export interface ChallengeHistoryItem {
  title: string
  emoji: string
  xp_reward: number
  completed_at: string
}
export interface SubscriptionInfo {
  status: 'active' | 'inactive' | 'canceled' | 'past_due' | 'trialing'
  plan: 'monthly' | 'yearly' | null
  current_period_end: string | null
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
  },

  async syncAchievements(achievements: Array<{ key: string; xp: number; unlocked_at: number }>): Promise<void> {
    await request('/achievements/sync', {
      method: 'POST',
      body: { achievements: achievements.map(a => ({ ...a, unlocked_at: new Date(a.unlocked_at).toISOString() })) }
    })
  },

  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    return request<LeaderboardEntry[]>('/leaderboard?type=global')
  },

  async getChallenges(): Promise<Challenge[]> {
    return request<Challenge[]>('/challenges')
  },

  async joinChallenge(id: string): Promise<unknown> {
    return request(`/challenges/${id}/join`, { method: 'POST' })
  },

  async updateChallengeProgress(userChallengeId: string, progress: number): Promise<unknown> {
    return request(`/challenges/${userChallengeId}/progress`, { method: 'POST', body: { progress } })
  },

  async getChallengeHistory(): Promise<ChallengeHistoryItem[]> {
    return request<ChallengeHistoryItem[]>('/challenges/history')
  },

  async getSubscription(): Promise<SubscriptionInfo> {
    return request<SubscriptionInfo>('/me/subscription')
  },

  async createCheckoutSession(): Promise<{ url: string }> {
    return request<{ url: string }>('/subscriptions/checkout', { method: 'POST' })
  },

  async createPortalSession(): Promise<{ url: string }> {
    return request<{ url: string }>('/subscriptions/portal', { method: 'POST' })
  }
}

export { UnauthorizedError }