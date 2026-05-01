import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import log from 'electron-log/main'
import { autoUpdater } from 'electron-updater'
import icon from '../../resources/icon.png?asset'
import trayIconPath from '../../resources/tray-icon.png?asset'
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

// ─── Logging setup ────────────────────────────────────────────
log.initialize()
log.transports.file.level = 'info'
log.transports.console.level = 'info'

process.on('uncaughtException', (err) => log.error('Uncaught exception:', err))
process.on('unhandledRejection', (err) => log.error('Unhandled rejection:', err))

log.info('PlayGuard starting...')
log.info('argv:', process.argv)

// ─── Auto-updater setup ───────────────────────────────────────
autoUpdater.logger = log
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('checking-for-update', () => {
  log.info('[updater] Checking for update...')
})

autoUpdater.on('update-available', (info) => {
  log.info('[updater] Update available:', info.version)
})

autoUpdater.on('update-not-available', (info) => {
  log.info('[updater] Up to date. Current:', info.version)
})

autoUpdater.on('error', (err) => {
  log.error('[updater] Error:', err)
})

autoUpdater.on('download-progress', (progress) => {
  log.info(
    `[updater] Downloading: ${progress.percent.toFixed(1)}% — ${(progress.bytesPerSecond / 1024).toFixed(0)} KB/s`
  )
})

autoUpdater.on('update-downloaded', async (info) => {
  log.info('[updater] Update downloaded:', info.version)

  // Show dialog to user
  const result = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    title: 'Update ready',
    message: `PlayGuard ${info.version} has been downloaded.`,
    detail: 'Restart the app to apply the update.'
  })

  if (result.response === 0) {
    isQuitting = true
    autoUpdater.quitAndInstall()
  }
  // If "Later" — will install on next quit (autoInstallOnAppQuit)
})

function checkForUpdates(): void {
  if (is.dev) {
    log.info('[updater] Skipped — dev mode')
    return
  }
  void autoUpdater.checkForUpdates()
}

// ─── Window creation ──────────────────────────────────────────
function createWindow(): void {
  log.info('Creating main window')
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
  try {
    const trayIcon = nativeImage.createFromPath(trayIconPath)
    tray = new Tray(trayIcon)

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open PlayGuard', click: showOrCreateWindow },
      { type: 'separator' },
      {
        label: 'Check for updates',
        click: () => {
          checkForUpdates()
        }
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
  } catch (err) {
    log.error('Failed to create tray:', err)
  }
}

// ─── App lifecycle ────────────────────────────────────────────
app.whenReady().then(() => {
  log.info('app.whenReady fired')
  electronApp.setAppUserModelId('net.playguard.app')

  const startedHidden = process.argv.includes('--hidden')

  // Sync auto-start with Windows state
  try {
    const actualAutoStart = app.getLoginItemSettings().openAtLogin
    const storedAppSettings = store.get('app')
    if (storedAppSettings.launchOnStartup !== actualAutoStart) {
      store.set('app', { ...storedAppSettings, launchOnStartup: actualAutoStart })
    }
  } catch (err) {
    log.error('Auto-start sync failed:', err)
  }

  try {
    startSessionManager()
  } catch (err) {
    log.error('startSessionManager failed:', err)
  }

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

  ipcMain.handle('auth:get-current-user', () => store.get('auth').user)

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

  ipcMain.handle('app:check-for-updates', () => {
    checkForUpdates()
    return true
    
  ipcMain.handle('app:get-version', () => {
    return app.getVersion()
  })
  })

  // ─── Window + tray ────────────────────────────────────────
  createTray()
  if (!startedHidden) {
    createWindow()
  }

  // Initial update check after 10 seconds (let app settle first)
  setTimeout(() => checkForUpdates(), 10_000)

  // Re-check every 4 hours
  setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000)

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