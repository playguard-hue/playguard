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
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: Api
  }
}