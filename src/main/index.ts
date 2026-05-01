import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { store, AppSettings } from './store'
import { detectActiveGame } from './gameDetection'
import {
  startSessionManager,
  getActiveSession,
  syncPendingSessions
} from './sessionManager'
import { api } from './apiClient'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (event) => {
    const shouldMinimize = store.get('app').minimizeToTray
    if (!isQuitting && shouldMinimize) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showOrCreateWindow(): void {
  if (mainWindow) {
    if (!mainWindow.isVisible()) mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
}

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(icon).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open PlayGuard',
      click: showOrCreateWindow
    },
    { type: 'separator' },
    {
      label: 'Quit PlayGuard',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('PlayGuard')
  tray.setContextMenu(contextMenu)
  tray.on('click', showOrCreateWindow)
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('net.playguard.app')

  // Was app launched at Windows startup with --hidden flag?
  const startedHidden = process.argv.includes('--hidden')

  // Sync auto-start setting with actual Windows state
  const actualAutoStart = app.getLoginItemSettings().openAtLogin
  const storedAppSettings = store.get('app')
  if (storedAppSettings.launchOnStartup !== actualAutoStart) {
    store.set('app', { ...storedAppSettings, launchOnStartup: actualAutoStart })
  }

  // Start polling for games
  startSessionManager()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ─── Settings IPC ─────────────────────────────────────────
  ipcMain.handle('settings:get-all', () => store.store)

  ipcMain.handle(
    'settings:set',
    (_event, section: keyof AppSettings, key: string, value: unknown) => {
      const current = store.get(section) as Record<string, unknown>
      store.set(section, { ...current, [key]: value })
      return store.store
    }
  )

  // ─── Auth IPC ─────────────────────────────────────────────
  const API_BASE = 'https://api.playguard.net'

  ipcMain.handle('auth:login', async (_e, email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || data.error || 'Login failed')
    store.set('auth', { token: data.token, user: data.user })
    return data.user
  })

  ipcMain.handle(
    'auth:register',
    async (_e, email: string, username: string, password: string) => {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Registration failed')
      store.set('auth', { token: data.token, user: data.user })
      return data.user
    }
  )

  ipcMain.handle('auth:logout', () => {
    store.set('auth', { token: null, user: null })
    return true
  })

  ipcMain.handle('auth:get-current-user', () => {
    return store.get('auth').user
  })

  // ─── Game / Session IPC ───────────────────────────────────
  ipcMain.handle('session:get-active', () => getActiveSession())

  ipcMain.handle('stats:get', async () => api.getStats())

  ipcMain.handle('sessions:get-history', async () => api.getSessions())

  ipcMain.handle('sessions:sync-now', async () => {
    await syncPendingSessions()
    return true
  })

  ipcMain.handle('game:detect-active', async () => detectActiveGame())

  // ─── App behavior IPC ─────────────────────────────────────
  ipcMain.handle('app:set-launch-on-startup', (_e, enabled: boolean) => {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: true,
      args: ['--hidden']
    })
    return enabled
  })

  ipcMain.handle('app:get-launch-on-startup', () => {
    return app.getLoginItemSettings().openAtLogin
  })

  // Always create tray; only create window if not started hidden
  createTray()
  if (!startedHidden) {
    createWindow()
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  tray?.destroy()
})