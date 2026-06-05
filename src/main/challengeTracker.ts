import log from 'electron-log/main'
import { store } from './store'
import { api, UnauthorizedError, Challenge } from './apiClient'
import type { CompletedSession } from './sessionManager'

interface MindfulMeta {
  hadPreIntent: boolean
  hadPostReflection: boolean
}

/**
 * Cache of active challenges. Refreshed periodically and on session end.
 */
let activeChallengesCache: Challenge[] = []

export async function refreshActiveChallenges(): Promise<void> {
  try {
    const all = await api.getChallenges()
    activeChallengesCache = all.filter((c) => c.user_challenge_id && !c.completed)
    log.info('[challenges] Active cache size:', activeChallengesCache.length)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      log.info('[challenges] Skipped — not logged in')
    } else {
      log.warn('[challenges] Refresh failed:', err)
    }
  }
}

function findActive(goalType: string): Challenge | undefined {
  return activeChallengesCache.find((c) => c.goal_type === goalType)
}

async function bumpProgress(challenge: Challenge, newProgress: number): Promise<void> {
  if (!challenge.user_challenge_id) return
  try {
    await api.updateChallengeProgress(challenge.user_challenge_id, newProgress)
    challenge.current_progress = newProgress
    log.info(`[challenges] ${challenge.id}: progress ${newProgress}/${challenge.goal_value}`)
  } catch (err) {
    log.warn(`[challenges] Failed to update ${challenge.id}:`, err)
  }
}

/**
 * Track a completed gaming session. Updates relevant challenges.
 */
export async function trackGameSession(
  session: CompletedSession,
  meta: MindfulMeta
): Promise<void> {
  await refreshActiveChallenges()

  // healthy-week: was the session within daily limit?
  const limits = store.get('limits')
  const dailyLimitSec = limits.dailyMinutes * 60
  if (session.durationSeconds <= dailyLimitSec) {
    const c = findActive('days_within_limit')
    if (c) await bumpProgress(c, (c.current_progress ?? 0) + 1)
  }

  // no-late-night: did the session avoid past 22:00?
  const endedHour = new Date(session.endedAt).getHours()
  if (endedHour < 22) {
    const c = findActive('nights_no_late')
    if (c) await bumpProgress(c, (c.current_progress ?? 0) + 1)
  }

  // mindful-week: did the user set intent before AND reflect after?
  if (meta.hadPreIntent && meta.hadPostReflection) {
    const c = findActive('intent_pairs')
    if (c) await bumpProgress(c, (c.current_progress ?? 0) + 1)
  }

  // no-rage: streak of sessions with 0 stress events
  const coolStreakKey = 'challengeCoolStreak'
  const currentStreak = (store.get(coolStreakKey) as number | undefined) ?? 0
  let newStreak = currentStreak
  if (!session.stressEvents || session.stressEvents.length === 0) {
    newStreak = currentStreak + 1
  } else {
    newStreak = 0
  }
  store.set(coolStreakKey, newStreak)
  if (newStreak > 0) {
    const c = findActive('cool_sessions_streak')
    if (c) await bumpProgress(c, newStreak)
  }
}

/**
 * Track a completed focus session. Updates focus-related challenges.
 */
export async function trackFocusSession(durationMs: number): Promise<void> {
  await refreshActiveChallenges()

  const minutes = Math.round(durationMs / (60 * 1000))
  if (minutes <= 0) return

  const c = findActive('focus_minutes')
  if (c) await bumpProgress(c, (c.current_progress ?? 0) + minutes)
}