import Store from 'electron-store'

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
  }
}

export const store = new Store<AppSettings>({
  defaults,
  encryptionKey: 'playguard-local-v1'
})