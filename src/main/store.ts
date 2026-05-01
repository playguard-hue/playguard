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
    breakReminders: true
  },
  limits: {
    dailyMinutes: 120,
    sessionMinutes: 45,
    breakIntervalMinutes: 30
  },
  auth: {
    token: null,
    user: null
  }
}

export const store = new Store<AppSettings>({
  defaults,
  encryptionKey: 'playguard-local-v1'
})