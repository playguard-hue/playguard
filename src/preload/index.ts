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