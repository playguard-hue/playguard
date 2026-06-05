import { ElectronAPI } from '@electron-toolkit/preload'

export interface User {
  id: string
  email: string
  username: string
}

export interface AppSettings {
  audio: {
    microphoneId: string
    stressDetection: boolean
  }
  app: {
    launchOnStartup: boolean
    minimizeToTray: boolean
  }
  notifications: {
    limitWarnings: boolean
    breakReminders: boolean
    hydrationReminders: boolean
    stretchReminders: boolean
  }
  limits: {
    dailyMinutes: number
    sessionMinutes: number
    breakIntervalMinutes: number
  }
  auth: {
    token: string | null
    user: User | null
  }
  streak: {
    currentDays: number
    longestDays: number
    lastCheckedDate: string
  }
  intent: {
    askBeforeSession: boolean
    askAfterSession: boolean
  }
  dailyIntent: {
    date: string
    priority: string
    energy: 'low' | 'normal' | 'high'
    gamingBudgetMinutes: number
  }
  ui: {
    focusBannerDismissed: boolean
    focusBannerSeenCount: number
  }
}

export interface StressEvent {
  timestamp: string
  source: 'voice' | 'keyboard'
  rms?: number
  durationMs?: number
  rate?: number
  key?: string
}

export interface ActiveSession {
  appId: string
  name: string
  source: string
  startedAt: number
  stressEvents: StressEvent[]
}

export interface Stats {
  total_sessions: number
  total_seconds: number
  avg_seconds: number
  today_seconds: number
}

export interface SessionHistoryItem {
  id: string
  game: string
  duration_seconds: number
  started_at: string
  ended_at: string
  created_at: string
}

export interface DriftEvent {
  timestamp: number
  fromApp: string
  toApp: string
  toCategory: string
  durationMs: number
}

export interface FocusSession {
  id: string
  intent: string
  plannedMinutes: number
  startedAt: number
  endedAt?: number
  drifts: DriftEvent[]
  reflection?: 'completed' | 'partial' | 'failed'
}

export interface DailyIntentData {
  date: string
  priority: string
  energy: 'low' | 'normal' | 'high'
  gamingBudgetMinutes: number
}

export type AchievementCategory = 'streak' | 'control' | 'mindful' | 'focus'
export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'

export interface Achievement {
  key: string
  category: AchievementCategory
  title: string
  description: string
  emoji: string
  rarity: AchievementRarity
  free: boolean
  unlocked: boolean
  unlockedAt: number | null
}

export interface UserStats {
  totalXp: number
  level: number
  currentXp: number
  xpForNext: number
  unlockedCount: number
  totalCount: number
}

export interface AchievementUnlockedEvent {
  def: {
    key: string
    title: string
    description: string
    emoji: string
    rarity: AchievementRarity
  }
  unlockedAt: number
}

export type AppCategoryValue =
  | 'work'
  | 'communication'
  | 'email'
  | 'browser'
  | 'design'
  | 'meetings'
  | 'media'
  | 'games'
  | 'system'
  | 'other'

export interface AppCategoryEntry {
  exeName: string
  appName: string
  category: AppCategoryValue
}

export interface HardInterventionEvent {
  distractorApp: string
  durationMs: number
  sessionIntent: string
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

export interface Api {
  settings: {
    getAll: () => Promise<AppSettings>
    set: (
      section: keyof AppSettings,
      key: string,
      value: unknown
    ) => Promise<AppSettings>
  }
  auth: {
    login: (email: string, password: string) => Promise<User>
    register: (email: string, username: string, password: string) => Promise<User>
    logout: () => Promise<boolean>
    getCurrentUser: () => Promise<User | null>
  }
  session: {
    getActive: () => Promise<ActiveSession | null>
    onUpdate: (callback: (session: ActiveSession | null) => void) => () => void
  }
  stats: {
    get: () => Promise<Stats>
    onInvalidated: (callback: () => void) => () => void
  }
  sessions: {
    getHistory: () => Promise<SessionHistoryItem[]>
    syncNow: () => Promise<boolean>
  }
  app: {
    setLaunchOnStartup: (enabled: boolean) => Promise<boolean>
    getLaunchOnStartup: () => Promise<boolean>
    getVersion: () => Promise<string>
    checkForUpdates: () => Promise<boolean>
  }
  streak: {
    get: () => Promise<{ currentDays: number; longestDays: number }>
    refresh: () => Promise<{ currentDays: number; longestDays: number } | null>
  }
  focus: {
    start: (intent: string, plannedMinutes: number) => Promise<FocusSession>
    end: (reflection: 'completed' | 'partial' | 'failed') => Promise<FocusSession | null>
    getActive: () => Promise<FocusSession | null>
    getHistory: () => Promise<FocusSession[]>
    onUpdate: (callback: (session: FocusSession | null) => void) => () => void
  }
  dailyIntent: {
    get: () => Promise<DailyIntentData>
    set: (priority: string, energy: 'low' | 'normal' | 'high', gamingBudgetMinutes: number) => Promise<DailyIntentData>
    shouldAsk: () => Promise<boolean>
  }
  achievements: {
    getAll: () => Promise<Achievement[]>
    refresh: () => Promise<boolean>
    getStats: () => Promise<UserStats>
    incrementMeta: (key: 'preSessionIntents' | 'postReflections' | 'hydrationAck' | 'stretchAck') => Promise<boolean>
    onUnlocked: (callback: (data: AchievementUnlockedEvent) => void) => () => void
  }
  appCategories: {
    getAll: () => Promise<AppCategoryEntry[]>
    set: (exeName: string, category: AppCategoryValue) => Promise<boolean>
  }
  focusHardIntervention: {
    onTriggered: (callback: (data: HardInterventionEvent) => void) => () => void
  }
  leaderboard: {
    get: () => Promise<{ data?: LeaderboardEntry[]; error?: string }>
  }
  challenges: {
    getAll: () => Promise<{ data?: Challenge[]; error?: string }>
    join: (id: string) => Promise<{ data?: unknown; error?: string }>
    getHistory: () => Promise<{ data?: ChallengeHistoryItem[]; error?: string }>
  }
  subscription: {
    get: () => Promise<{ data?: SubscriptionInfo; error?: string }>
    checkout: () => Promise<{ data?: { url: string }; error?: string }>
    portal: () => Promise<{ data?: { url: string }; error?: string }>
  }
  shell: {
    openExternal: (url: string) => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}