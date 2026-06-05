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
  syncPendingSessions,
  flushActiveSession
} from './sessionManager'
import { api } from './apiClient'
import { registerStressIpc, destroyWorkerWindow } from './stressMonitor'
import { destroyKeyboardHook } from './keyboardMonitor'
import { refreshStreak, getStreak } from './streakCalculator'
import {
  initFocusManager,
  startFocusSession,
  endFocusSession,
  getActiveFocusSession,
  getFocusHistory
} from './focusManager'
import { stopWindowMonitoring, getRecentAppsSeen, setAppCategory } from './windowMonitor'
import {
  ACHIEVEMENTS,
  getUnlockedAchievements,
  refreshAchievements,
  incrementMeta,
  getUserStats,
  RARITY_XP,
  getAchievementDef
} from './achievements'

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
})
async function syncAchievementsToBackend(): Promise<void> {
  try {
    const unlocked = getUnlockedAchievements()
    if (unlocked.length === 0) return
    const payload = unlocked.map((u) => {
      const def = getAchievementDef(u.key)
      return {
        key: u.key,
        xp: def ? RARITY_XP[def.rarity] : 0,
        unlocked_at: u.unlockedAt
      }
    })
    await api.syncAchievements(payload)
    log.info('[achievements] Synced to backend:', payload.length)
  } catch (err) {
    log.warn('[achievements] Sync to backend failed:', err)
  }
}
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
    title: 'PlayGuard',
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

  // Register IPC handlers for stress monitor (must be before session start)
  registerStressIpc()

  // Initialize focus manager (subscribes to window changes)
  initFocusManager()

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
  })

  ipcMain.handle('app:get-version', () => {
    return app.getVersion()
  })
// ─── Streak IPC ───────────────────────────────────────────
  ipcMain.handle('streak:get', () => getStreak())
  ipcMain.handle('streak:refresh', async () => refreshStreak())
  // ─── Focus Mode IPC ───────────────────────────────────────
  ipcMain.handle('focus:start', (_e, intent: string, plannedMinutes: number) => {
    return startFocusSession(intent, plannedMinutes)
  })
  ipcMain.handle('focus:end', (_e, reflection: 'completed' | 'partial' | 'failed') => {
    return endFocusSession(reflection)
  })
  ipcMain.handle('focus:get-active', () => getActiveFocusSession())
  ipcMain.handle('focus:get-history', () => getFocusHistory())

  // ─── Daily Intent IPC ─────────────────────────────────────
  ipcMain.handle('dailyIntent:get', () => store.get('dailyIntent'))
  ipcMain.handle(
    'dailyIntent:set',
    (_e, priority: string, energy: 'low' | 'normal' | 'high', gamingBudgetMinutes: number) => {
      const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
      const updated = {
        date: today,
        priority,
        energy,
        gamingBudgetMinutes
      }
      store.set('dailyIntent', updated)
      return updated
    }
  )
  ipcMain.handle('dailyIntent:should-ask', () => {
    const intent = store.get('dailyIntent')
    const today = new Date().toISOString().slice(0, 10)
    return intent.date !== today
  })
  // ─── Achievements IPC ─────────────────────────────────────
  ipcMain.handle('achievements:get-all', () => {
    const unlocked = getUnlockedAchievements()
    return ACHIEVEMENTS.map((def) => {
      const found = unlocked.find((u) => u.key === def.key)
      return {
        ...def,
        unlocked: !!found,
        unlockedAt: found?.unlockedAt ?? null
      }
    })
  })
  ipcMain.handle('achievements:refresh', async () => {
    await refreshAchievements()
    return true
  })
  ipcMain.handle(
    'achievements:increment-meta',
    (_e, key: 'preSessionIntents' | 'postReflections' | 'hydrationAck' | 'stretchAck') => {
      incrementMeta(key)
      return true
    }
  )
  ipcMain.handle('achievements:get-stats', () => {
    return getUserStats()
  })
  // ─── Leaderboard IPC ──────────────────────────────────────
  ipcMain.handle('leaderboard:get', async () => {
    try {
      const data = await api.getLeaderboard()
      return { data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { error: msg }
    }
  })
  // ─── Subscription IPC ─────────────────────────────────────
  ipcMain.handle('subscription:get', async () => {
    try {
      const data = await api.getSubscription()
      return { data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { error: msg }
    }
  })

  ipcMain.handle('subscription:checkout', async () => {
    try {
      const data = await api.createCheckoutSession()
      if (data.url) {
        await shell.openExternal(data.url)
      }
      return { data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { error: msg }
    }
  })
  ipcMain.handle('subscription:portal', async () => {
    try {
      const data = await api.createPortalSession()
      if (data.url) {
        await shell.openExternal(data.url)
      }
      return { data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { error: msg }
    }
  })
  ipcMain.handle('shell:open-external', (_, url: string) => {
    shell.openExternal(url)
  })
  // ─── Challenges IPC ───────────────────────────────────────
  ipcMain.handle('challenges:get-all', async () => {
    try {
      const data = await api.getChallenges()
      return { data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { error: msg }
    }
  })

  ipcMain.handle('challenges:join', async (_e, id: string) => {
    try {
      const data = await api.joinChallenge(id)
      return { data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { error: msg }
    }
  })

  ipcMain.handle('challenges:get-history', async () => {
    try {
      const data = await api.getChallengeHistory()
      return { data }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      return { error: msg }
    }
  })
  // ─── App categories IPC ───────────────────────────────────
  ipcMain.handle('appCategories:get-all', () => {
    return getRecentAppsSeen()
  })
  ipcMain.handle(
    'appCategories:set',
    (_e, exeName: string, category: string) => {
      setAppCategory(exeName, category as 'work' | 'communication' | 'email' | 'browser' | 'design' | 'meetings' | 'media' | 'games' | 'system' | 'other')
      return true
    }
  )
  // ─── Window + tray ────────────────────────────────────────
  createTray()
  if (!startedHidden) {
    createWindow()
  }

  // Initial update check after 10 seconds
  setTimeout(() => checkForUpdates(), 10_000)

  // Re-check every 4 hours
  setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000)

  // Refresh streak after app settles, then every hour
  setTimeout(() => void refreshStreak(), 5_000)
  setInterval(() => void refreshStreak(), 60 * 60 * 1000)

  // Refresh achievements after streak settles
  setTimeout(async () => {
    await refreshAchievements()
    await syncAchievementsToBackend()
  }, 8_000)
  setInterval(async () => {
    await refreshAchievements()
    await syncAchievementsToBackend()
  }, 60 * 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit()
  }
})

let hasFlushed = false

app.on('before-quit', async (event) => {
  if (!hasFlushed) {
    event.preventDefault()
    hasFlushed = true
    isQuitting = true
    try {
      await flushActiveSession()
      // Try to sync to backend (best effort, with short timeout)
      await Promise.race([
        syncPendingSessions(),
        new Promise((resolve) => setTimeout(resolve, 3000))
      ])
    } catch (err) {
      log.error('[before-quit] Failed to flush session:', err)
    }
    tray?.destroy()
    destroyWorkerWindow()
    destroyKeyboardHook()
    stopWindowMonitoring()
    app.quit()
    return
  }
  tray?.destroy()
  destroyWorkerWindow()
  destroyKeyboardHook()
  stopWindowMonitoring()
})