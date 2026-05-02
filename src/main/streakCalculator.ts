import log from 'electron-log/main'
import { store } from './store'
import { api, UnauthorizedError } from './apiClient'

interface DailyTotal {
  date: string // YYYY-MM-DD in local time
  totalSeconds: number
}

function isoDate(d: Date): string {
  // Local-date YYYY-MM-DD (avoiding UTC shift)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function groupSessionsByDay(
  sessions: Array<{ started_at: string; duration_seconds: number }>
): DailyTotal[] {
  const map = new Map<string, number>()
  for (const s of sessions) {
    const date = isoDate(new Date(s.started_at))
    const seconds = Number(s.duration_seconds) || 0
    map.set(date, (map.get(date) ?? 0) + seconds)
  }
  return Array.from(map.entries())
    .map(([date, totalSeconds]) => ({ date, totalSeconds }))
    .sort((a, b) => b.date.localeCompare(a.date)) // newest first
}

function calculateStreakFromHistory(
  dailyTotals: DailyTotal[],
  dailyLimitMinutes: number
): number {
  if (dailyTotals.length === 0) return 0

  const dailyLimitSeconds = dailyLimitMinutes * 60
  const today = isoDate(new Date())

  // Find oldest session date — streak can't go further back than this
  const earliestDate = dailyTotals
    .map((d) => d.date)
    .sort()[0]

  let streak = 0
  const currentDate = new Date()

  while (streak <= 365) {
    const checkDate = isoDate(currentDate)

    // Don't count days before the user's first session
    if (checkDate < earliestDate) break

    const found = dailyTotals.find((d) => d.date === checkDate)
    const dayTotal = found ? found.totalSeconds : 0

    if (checkDate === today) {
      // Today: count it only if still within limit
      if (dayTotal > dailyLimitSeconds) break
      streak += 1
    } else {
      // Past day: must have either gaming-within-limit, OR no gaming at all
      // BUT only if user already had at least one session before this day
      if (dayTotal > dailyLimitSeconds) break
      streak += 1
    }

    currentDate.setDate(currentDate.getDate() - 1)
  }

  return streak
}

export async function refreshStreak(): Promise<{
  currentDays: number
  longestDays: number
} | null> {
  try {
    const sessions = await api.getSessions()
    const dailyLimit = store.get('limits').dailyMinutes
    const dailyTotals = groupSessionsByDay(sessions)

const currentDays = calculateStreakFromHistory(dailyTotals, dailyLimit)

    const stored = store.get('streak')
    const longestDays = Math.max(stored.longestDays, currentDays)

    store.set('streak', {
      currentDays,
      longestDays,
      lastCheckedDate: isoDate(new Date())
    })

    log.info(`[streak] current=${currentDays} longest=${longestDays}`)
    return { currentDays, longestDays }
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      log.info('[streak] Skipped — not logged in')
    } else {
      log.error('[streak] Refresh failed:', err)
    }
    return null
  }
}

export function getStreak(): { currentDays: number; longestDays: number } {
  const stored = store.get('streak')
  return {
    currentDays: stored.currentDays,
    longestDays: stored.longestDays
  }
}