import log from 'electron-log/main'
import { BrowserWindow, Notification } from 'electron'
import { store } from './store'
import { api, UnauthorizedError } from './apiClient'

export type AchievementCategory = 'streak' | 'control' | 'mindful' | 'focus'

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'

export const RARITY_XP: Record<AchievementRarity, number> = {
  common: 50,
  rare: 150,
  epic: 500,
  legendary: 1500
}

export interface AchievementDef {
  key: string
  category: AchievementCategory
  title: string
  description: string
  emoji: string
  rarity: AchievementRarity
  free: boolean
}

/**
 * XP curve: XP needed to reach level N = 100 * N * 1.5
 * Cumulative XP for level N = sum from 1 to N
 */
export function xpForNextLevel(currentLevel: number): number {
  return Math.floor(100 * currentLevel * 1.5)
}

export function calculateLevel(totalXp: number): { level: number; currentXp: number; xpForNext: number } {
  let level = 1
  let xpRemaining = totalXp

  while (true) {
    const needed = xpForNextLevel(level)
    if (xpRemaining < needed) {
      return { level, currentXp: xpRemaining, xpForNext: needed }
    }
    xpRemaining -= needed
    level += 1
    if (level > 100) break // safety cap
  }

  return { level, currentXp: xpRemaining, xpForNext: xpForNextLevel(level) }
}

export interface UnlockedAchievement {
  key: string
  unlockedAt: number
  metadata?: Record<string, unknown>
}

// All achievements catalog
export const ACHIEVEMENTS: AchievementDef[] = [
  // ─── STREAKS ─────────────────────────────────────────────
  {
    key: 'first-step',
    category: 'streak',
    title: 'First Step',
    description: '1 day healthy gaming streak',
    emoji: '🌱',
    rarity: 'common',
    free: true
  },
  {
    key: 'week-warrior',
    category: 'streak',
    title: 'Week Warrior',
    description: '7 day healthy gaming streak',
    emoji: '🔥',
    rarity: 'rare',
    free: true
  },
  {
    key: 'monthly-master',
    category: 'streak',
    title: 'Monthly Master',
    description: '30 day healthy gaming streak',
    emoji: '🏆',
    rarity: 'epic',
    free: false
  },
  {
    key: 'centurion',
    category: 'streak',
    title: 'Centurion',
    description: '100 day healthy gaming streak',
    emoji: '💎',
    rarity: 'legendary',
    free: false
  },

  // ─── SELF CONTROL ────────────────────────────────────────
  {
    key: 'limit-respecter',
    category: 'control',
    title: 'Limit Respecter',
    description: 'Stayed within daily limit 10 times',
    emoji: '🛡️',
    rarity: 'common',
    free: true
  },
  {
    key: 'early-stopper',
    category: 'control',
    title: 'Early Stopper',
    description: 'Ended a session early 5 times (>30 min remaining)',
    emoji: '⏹️',
    rarity: 'epic',
    free: false
  },
  {
    key: 'cool-head',
    category: 'control',
    title: 'Cool Head',
    description: '5 sessions without any stress events',
    emoji: '🧊',
    rarity: 'rare',
    free: false
  },
  {
    key: 'self-aware',
    category: 'control',
    title: 'Self-Aware',
    description: 'Set pre-game intent 20 times',
    emoji: '🧭',
    rarity: 'epic',
    free: false
  },

  // ─── MINDFULNESS ─────────────────────────────────────────
  {
    key: 'hydration-hero',
    category: 'mindful',
    title: 'Hydration Hero',
    description: 'Acknowledged 50 hydration reminders',
    emoji: '💧',
    rarity: 'epic',
    free: false
  },
  {
    key: 'stretch-sensei',
    category: 'mindful',
    title: 'Stretch Sensei',
    description: 'Acknowledged 25 stretch reminders',
    emoji: '🧘',
    rarity: 'epic',
    free: false
  },
  {
    key: 'reflective-mind',
    category: 'mindful',
    title: 'Reflective Mind',
    description: 'Completed 10 post-session reflections',
    emoji: '📝',
    rarity: 'rare',
    free: true
  },

  // ─── FOCUS MODE ──────────────────────────────────────────
  {
    key: 'first-focus',
    category: 'focus',
    title: 'First Focus',
    description: 'Completed your first focus session',
    emoji: '🎯',
    rarity: 'common',
    free: true
  },
  {
    key: 'deep-worker',
    category: 'focus',
    title: 'Deep Worker',
    description: 'Completed a 90+ minute focus session with 0 drifts',
    emoji: '🧠',
    rarity: 'legendary',
    free: false
  },
  {
    key: 'focus-athlete',
    category: 'focus',
    title: 'Focus Athlete',
    description: '10 total hours of focused work',
    emoji: '⚡',
    rarity: 'epic',
    free: false
  },
  {
    key: 'no-distraction',
    category: 'focus',
    title: 'Zero Distraction',
    description: '5 focus sessions with 0 drifts each',
    emoji: '🌟',
    rarity: 'epic',
    free: false
  }
]

export function getAchievementDef(key: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.key === key)
}

function showAchievementNotification(def: AchievementDef): void {
  if (Notification.isSupported()) {
    new Notification({
      title: `Achievement Unlocked! ${def.emoji}`,
      body: `${def.title} — ${def.description}`,
      silent: false
    }).show()
  }
}

function broadcastAchievementUnlocked(achievement: UnlockedAchievement, def: AchievementDef): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('achievement:unlocked', { achievement, def })
  }
}

function getUnlocked(): UnlockedAchievement[] {
  return (store.get('achievements') as UnlockedAchievement[]) ?? []
}

function setUnlocked(list: UnlockedAchievement[]): void {
  store.set('achievements', list)
}

function isUnlocked(key: string, unlocked: UnlockedAchievement[]): boolean {
  return unlocked.some((u) => u.key === key)
}

function unlockAchievement(key: string, metadata?: Record<string, unknown>): boolean {
  const unlocked = getUnlocked()
  if (isUnlocked(key, unlocked)) return false

  const def = getAchievementDef(key)
  if (!def) {
    log.warn('[achievements] Unknown key:', key)
    return false
  }

  const newAchievement: UnlockedAchievement = {
    key,
    unlockedAt: Date.now(),
    metadata
  }
  unlocked.push(newAchievement)
  setUnlocked(unlocked)

  log.info('[achievements] Unlocked:', key)
  showAchievementNotification(def)
  broadcastAchievementUnlocked(newAchievement, def)

  return true
}

interface AchievementsContext {
  sessions: Array<{
    duration_seconds: number | string
    started_at: string
    stress_events?: unknown[]
  }>
  focusHistory: Array<{
    plannedMinutes: number
    startedAt: number
    endedAt?: number
    drifts: unknown[]
  }>
  streakDays: number
  intentCounts: {
    preSession: number
    postReflection: number
  }
  reminderCounts: {
    hydrationAck: number
    stretchAck: number
  }
}

/**
 * Check all achievements against current state. Unlocks any newly-qualified.
 */
export function checkAllAchievements(ctx: AchievementsContext): void {
  // Streak achievements
  if (ctx.streakDays >= 1) unlockAchievement('first-step')
  if (ctx.streakDays >= 7) unlockAchievement('week-warrior')
  if (ctx.streakDays >= 30) unlockAchievement('monthly-master')
  if (ctx.streakDays >= 100) unlockAchievement('centurion')

  // Limit respecter — count days within limit (from streak essentially)
  // For now, approximation: if user has 10+ sessions and ratio of within-limit days is high
  const sessionsCount = ctx.sessions.length
  if (sessionsCount >= 10) unlockAchievement('limit-respecter')

  // Cool head — 5 sessions with 0 stress events
  const coolSessions = ctx.sessions.filter(
    (s) => !s.stress_events || s.stress_events.length === 0
  )
  if (coolSessions.length >= 5) unlockAchievement('cool-head')

  // Self-aware — set intent 20 times
  if (ctx.intentCounts.preSession >= 20) unlockAchievement('self-aware')

  // Reflective mind — 10 post reflections
  if (ctx.intentCounts.postReflection >= 10) unlockAchievement('reflective-mind')

  // Hydration hero
  if (ctx.reminderCounts.hydrationAck >= 50) unlockAchievement('hydration-hero')

  // Stretch sensei
  if (ctx.reminderCounts.stretchAck >= 25) unlockAchievement('stretch-sensei')

  // Focus achievements
  if (ctx.focusHistory.length >= 1) unlockAchievement('first-focus')

  // Deep worker — 90+ min focus with 0 drifts
  const deepSession = ctx.focusHistory.find(
    (s) => s.endedAt && (s.endedAt - s.startedAt) >= 90 * 60 * 1000 && s.drifts.length === 0
  )
  if (deepSession) unlockAchievement('deep-worker')

  // Focus athlete — 10 hours total focused work
  const totalFocusMs = ctx.focusHistory.reduce((sum, s) => {
    return sum + ((s.endedAt ?? s.startedAt) - s.startedAt)
  }, 0)
  if (totalFocusMs >= 10 * 60 * 60 * 1000) unlockAchievement('focus-athlete')

  // No distraction — 5 sessions with 0 drifts
  const noDriftSessions = ctx.focusHistory.filter((s) => s.drifts.length === 0 && s.endedAt)
  if (noDriftSessions.length >= 5) unlockAchievement('no-distraction')

  // Early stopper — we can't easily detect from history alone
  // (would need to track manual session ends vs auto-detect)
  // TODO: track manual end events
}

export async function refreshAchievements(): Promise<void> {
  try {
    let sessions: Array<{ duration_seconds: number; started_at: string; stress_events?: unknown[] }> = []
    try {
      sessions = await api.getSessions()
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        log.info('[achievements] Skipped sessions fetch — not logged in')
      } else {
        throw err
      }
    }

    const focusHistory = (store.get('focusHistory') as Array<{
      plannedMinutes: number
      startedAt: number
      endedAt?: number
      drifts: unknown[]
    }>) ?? []

    const streak = store.get('streak')
    const meta = store.get('achievementMeta') as {
      preSessionIntents: number
      postReflections: number
      hydrationAck: number
      stretchAck: number
    } | undefined

    const ctx: AchievementsContext = {
      sessions,
      focusHistory,
      streakDays: streak.currentDays,
      intentCounts: {
        preSession: meta?.preSessionIntents ?? 0,
        postReflection: meta?.postReflections ?? 0
      },
      reminderCounts: {
        hydrationAck: meta?.hydrationAck ?? 0,
        stretchAck: meta?.stretchAck ?? 0
      }
    }

    checkAllAchievements(ctx)
  } catch (err) {
    log.error('[achievements] Refresh failed:', err)
  }
}

export function getUnlockedAchievements(): UnlockedAchievement[] {
  return getUnlocked()
}

export function incrementMeta(key: 'preSessionIntents' | 'postReflections' | 'hydrationAck' | 'stretchAck'): void {
  const meta = (store.get('achievementMeta') as Record<string, number>) ?? {}
  meta[key] = (meta[key] ?? 0) + 1
  store.set('achievementMeta', meta)
  // Async trigger check (don't await)
  void refreshAchievements()
}
export function getUserStats(): {
  totalXp: number
  level: number
  currentXp: number
  xpForNext: number
  unlockedCount: number
  totalCount: number
} {
  const unlocked = getUnlocked()
  const totalXp = unlocked.reduce((sum, u) => {
    const def = getAchievementDef(u.key)
    if (!def) return sum
    return sum + RARITY_XP[def.rarity]
  }, 0)
  const { level, currentXp, xpForNext } = calculateLevel(totalXp)
  return {
    totalXp,
    level,
    currentXp,
    xpForNext,
    unlockedCount: unlocked.length,
    totalCount: ACHIEVEMENTS.length
  }
}