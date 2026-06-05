import Store from 'electron-store'

export type AppCategoryOverride = 'work' | 'communication' | 'email' | 'browser' | 'design' | 'meetings' | 'media' | 'games' | 'system' | 'other'

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
    user: {
      id: string
      email: string
      username: string
    } | null
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
  customAppCategories: Record<string, AppCategoryOverride>
  challengeCoolStreak: number
}

const defaults: AppSettings = {
  audio: {
    microphoneId: 'default',
    stressDetection: false
  },
  app: {
    launchOnStartup: false,
    minimizeToTray: true
  },
  notifications: {
    limitWarnings: true,
    breakReminders: true,
    hydrationReminders: true,
    stretchReminders: true
  },
  limits: {
    dailyMinutes: 120,
    sessionMinutes: 45,
    breakIntervalMinutes: 30
  },
  auth: {
    token: null,
    user: null
  },
  streak: {
    currentDays: 0,
    longestDays: 0,
    lastCheckedDate: ''
  },
  intent: {
    askBeforeSession: true,
    askAfterSession: true
  },
  dailyIntent: {
    date: '',
    priority: '',
    energy: 'normal',
    gamingBudgetMinutes: 60
  },
  ui: {
    focusBannerDismissed: false,
    focusBannerSeenCount: 0
  },
  customAppCategories: {},
  challengeCoolStreak: 0
}

export const store = new Store<AppSettings>({
  defaults,
  encryptionKey: 'playguard-local-v1'
})