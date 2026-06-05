import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (section: string, key: string, value: unknown) =>
      ipcRenderer.invoke('settings:set', section, key, value)
  },
  auth: {
    login: (email: string, password: string) =>
      ipcRenderer.invoke('auth:login', email, password),
    register: (email: string, username: string, password: string) =>
      ipcRenderer.invoke('auth:register', email, username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:get-current-user')
  },
  session: {
    getActive: () => ipcRenderer.invoke('session:get-active'),
    onUpdate: (callback: (session: unknown) => void) => {
      const handler = (_e: unknown, session: unknown): void => callback(session)
      ipcRenderer.on('session:update', handler)
      return () => ipcRenderer.removeListener('session:update', handler)
    }
  },
  stats: {
    get: () => ipcRenderer.invoke('stats:get'),
    onInvalidated: (callback: () => void) => {
      const handler = (): void => callback()
      ipcRenderer.on('stats:invalidated', handler)
      return () => ipcRenderer.removeListener('stats:invalidated', handler)
    }
  },
  sessions: {
    getHistory: () => ipcRenderer.invoke('sessions:get-history'),
    syncNow: () => ipcRenderer.invoke('sessions:sync-now')
  },
  app: {
    setLaunchOnStartup: (enabled: boolean) =>
      ipcRenderer.invoke('app:set-launch-on-startup', enabled),
    getLaunchOnStartup: () => ipcRenderer.invoke('app:get-launch-on-startup'),
    getVersion: () => ipcRenderer.invoke('app:get-version'),
    checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates')
  },
  streak: {
    get: () => ipcRenderer.invoke('streak:get'),
    refresh: () => ipcRenderer.invoke('streak:refresh')
  },
  focus: {
    start: (intent: string, plannedMinutes: number) =>
      ipcRenderer.invoke('focus:start', intent, plannedMinutes),
    end: (reflection: 'completed' | 'partial' | 'failed') =>
      ipcRenderer.invoke('focus:end', reflection),
    getActive: () => ipcRenderer.invoke('focus:get-active'),
    getHistory: () => ipcRenderer.invoke('focus:get-history'),
    onUpdate: (callback: (session: unknown) => void) => {
      const handler = (_e: unknown, session: unknown): void => callback(session)
      ipcRenderer.on('focus:update', handler)
      return () => ipcRenderer.removeListener('focus:update', handler)
    }
  },
  dailyIntent: {
    get: () => ipcRenderer.invoke('dailyIntent:get'),
    set: (priority: string, energy: string, gamingBudgetMinutes: number) =>
      ipcRenderer.invoke('dailyIntent:set', priority, energy, gamingBudgetMinutes),
    shouldAsk: () => ipcRenderer.invoke('dailyIntent:should-ask')
  },
  achievements: {
    getAll: () => ipcRenderer.invoke('achievements:get-all'),
    refresh: () => ipcRenderer.invoke('achievements:refresh'),
    getStats: () => ipcRenderer.invoke('achievements:get-stats'),
    incrementMeta: (key: 'preSessionIntents' | 'postReflections' | 'hydrationAck' | 'stretchAck') =>
      ipcRenderer.invoke('achievements:increment-meta', key),
    onUnlocked: (callback: (data: unknown) => void) => {
      const handler = (_e: unknown, data: unknown): void => callback(data)
      ipcRenderer.on('achievement:unlocked', handler)
      return () => ipcRenderer.removeListener('achievement:unlocked', handler)
    }
  },
  appCategories: {
    getAll: () => ipcRenderer.invoke('appCategories:get-all'),
    set: (exeName: string, category: string) =>
      ipcRenderer.invoke('appCategories:set', exeName, category)
  },
  focusHardIntervention: {
    onTriggered: (callback: (data: unknown) => void) => {
      const handler = (_e: unknown, data: unknown): void => callback(data)
      ipcRenderer.on('focus:hard-intervention', handler)
      return () => ipcRenderer.removeListener('focus:hard-intervention', handler)
    }
  },
  leaderboard: {
    get: () => ipcRenderer.invoke('leaderboard:get')
  },
  challenges: {
    getAll: () => ipcRenderer.invoke('challenges:get-all'),
    join: (id: string) => ipcRenderer.invoke('challenges:join', id),
    getHistory: () => ipcRenderer.invoke('challenges:get-history')
  },
  subscription: {
    get: () => ipcRenderer.invoke('subscription:get'),
    checkout: () => ipcRenderer.invoke('subscription:checkout'),
    portal: () => ipcRenderer.invoke('subscription:portal')
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}