import { BrowserWindow, Notification } from 'electron'
import log from 'electron-log/main'
import { store } from './store'
import {
  onWindowChange,
  startWindowMonitoring,
  stopWindowMonitoring,
  WindowInfo
} from './windowMonitor'
import { trackFocusSession } from './challengeTracker'

export interface FocusSession {
  id: string
  intent: string
  plannedMinutes: number // 0 = no plan
  startedAt: number
  endedAt?: number
  drifts: DriftEvent[]
  reflection?: 'completed' | 'partial' | 'failed'
}

export interface DriftEvent {
  timestamp: number
  fromApp: string
  toApp: string
  toCategory: string
  durationMs: number
}

const DRIFT_THRESHOLD_MS = 30 * 1000
const DRIFT_NOTIFICATION_COOLDOWN_MS = 90 * 1000

// Hard intervention — PlayGuard window pops to foreground after sustained drift
const HARD_INTERVENTION_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes
const HARD_INTERVENTION_COOLDOWN_MS = 10 * 60 * 1000 // once per 10 min max
let lastHardInterventionTime = 0

let activeFocusSession: FocusSession | null = null
let driftStartTime: number | null = null
let driftCurrentApp: WindowInfo | null = null
let lastDriftNotificationTime = 0
let initialFocusApp: string | null = null
let hardInterventionTimer: NodeJS.Timeout | null = null

function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show()
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function broadcastFocusUpdate(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('focus:update', activeFocusSession)
  }
}

const DISTRACTING_CATEGORIES = new Set(['communication', 'media', 'games'])

function showHardIntervention(distractorApp: WindowInfo): void {
  if (!activeFocusSession) return
  const now = Date.now()
  if (now - lastHardInterventionTime < HARD_INTERVENTION_COOLDOWN_MS) return

  lastHardInterventionTime = now
  log.info('[focus] HARD intervention triggered for app:', distractorApp.appName)

  // Bring main window to foreground
  const windows = BrowserWindow.getAllWindows()
  const mainWin = windows.find((w) => !w.isDestroyed())
  if (mainWin) {
    if (mainWin.isMinimized()) mainWin.restore()
    mainWin.show()
    mainWin.focus()
    mainWin.setAlwaysOnTop(true)
    setTimeout(() => {
      if (!mainWin.isDestroyed()) mainWin.setAlwaysOnTop(false)
    }, 2000)

    mainWin.webContents.send('focus:hard-intervention', {
      distractorApp: distractorApp.appName,
      durationMs: now - (driftStartTime ?? now),
      sessionIntent: activeFocusSession.intent
    })
  }

  showNotification(
    `You've been on ${distractorApp.appName} for 5+ minutes`,
    `Your focus: "${activeFocusSession.intent}". Time to come back?`
  )
}

function checkDrift(triggeredBy: WindowInfo): void {
  if (!activeFocusSession) return
  if (!driftStartTime || !driftCurrentApp) return
  if (driftCurrentApp.exeName !== triggeredBy.exeName) return

  const now = Date.now()
  const drift: DriftEvent = {
    timestamp: driftStartTime,
    fromApp: initialFocusApp ?? 'unknown',
    toApp: driftCurrentApp.appName,
    toCategory: driftCurrentApp.category,
    durationMs: now - driftStartTime
  }
  activeFocusSession.drifts.push(drift)
  log.info('[focus] Drift detected:', drift)
  broadcastFocusUpdate()

  if (now - lastDriftNotificationTime > DRIFT_NOTIFICATION_COOLDOWN_MS) {
    lastDriftNotificationTime = now
    showNotification(
      `Focus drift to ${driftCurrentApp.appName}`,
      `You said you wanted to focus on: "${activeFocusSession.intent}". Quick context switch?`
    )
  }
}

function handleWindowChange(win: WindowInfo | null): void {
  if (!activeFocusSession || !win) return

  // First window seen since session start — record as the "focus app"
  if (initialFocusApp === null) {
    initialFocusApp = win.exeName
    return
  }

  if (driftCurrentApp && driftCurrentApp.exeName === win.exeName) return

  const isDistracting = DISTRACTING_CATEGORIES.has(win.category)
  const isDifferentFromFocus = win.exeName !== initialFocusApp

  // User switched back to focus app
  if (!isDifferentFromFocus) {
    if (driftStartTime && driftCurrentApp) {
      const duration = Date.now() - driftStartTime
      if (duration >= DRIFT_THRESHOLD_MS) {
        const drifts = activeFocusSession.drifts
        const last = drifts[drifts.length - 1]
        if (last && last.toApp === driftCurrentApp.appName) {
          last.durationMs = duration
        }
      }
      driftStartTime = null
      driftCurrentApp = null
    }
    if (hardInterventionTimer) {
      clearTimeout(hardInterventionTimer)
      hardInterventionTimer = null
    }
    return
  }

  // Switched to different app
  if (isDistracting) {
    driftStartTime = Date.now()
    driftCurrentApp = win

    setTimeout(() => checkDrift(win), DRIFT_THRESHOLD_MS)

    if (hardInterventionTimer) clearTimeout(hardInterventionTimer)
    hardInterventionTimer = setTimeout(() => {
      if (driftCurrentApp && driftCurrentApp.exeName === win.exeName) {
        showHardIntervention(win)
      }
    }, HARD_INTERVENTION_THRESHOLD_MS)
  } else {
    driftStartTime = null
    driftCurrentApp = null
    if (hardInterventionTimer) {
      clearTimeout(hardInterventionTimer)
      hardInterventionTimer = null
    }
  }
}

export function startFocusSession(intent: string, plannedMinutes: number): FocusSession {
  if (activeFocusSession) {
    log.info('[focus] Already in session, ignoring start request')
    return activeFocusSession
  }

  activeFocusSession = {
    id: generateId(),
    intent,
    plannedMinutes,
    startedAt: Date.now(),
    drifts: []
  }

  initialFocusApp = null
  driftStartTime = null
  driftCurrentApp = null
  lastDriftNotificationTime = 0

  startWindowMonitoring()

  log.info('[focus] Session started:', activeFocusSession)
  broadcastFocusUpdate()

  if (plannedMinutes > 0) {
    setTimeout(
      () => {
        if (activeFocusSession) {
          showNotification(
            'Focus session complete',
            `You planned ${plannedMinutes} minutes on "${intent}". How did it go?`
          )
        }
      },
      plannedMinutes * 60 * 1000
    )
  }

  return activeFocusSession
}

export function endFocusSession(
  reflection: 'completed' | 'partial' | 'failed'
): FocusSession | null {
  if (!activeFocusSession) return null

  activeFocusSession.endedAt = Date.now()
  activeFocusSession.reflection = reflection

  const history = (store.get('focusHistory') as FocusSession[]) ?? []
  history.push(activeFocusSession)
  const trimmed = history.slice(-100)
  store.set('focusHistory', trimmed)

  const completed = activeFocusSession
  const durationMs = (completed.endedAt ?? Date.now()) - completed.startedAt
  activeFocusSession = null
  initialFocusApp = null
  driftStartTime = null
  driftCurrentApp = null

  stopWindowMonitoring()

  // Track for challenges
  void trackFocusSession(durationMs)

  if (hardInterventionTimer) {
    clearTimeout(hardInterventionTimer)
    hardInterventionTimer = null
  }
  lastHardInterventionTime = 0

  log.info('[focus] Session ended:', completed)
  broadcastFocusUpdate()

  return completed
}

export function getActiveFocusSession(): FocusSession | null {
  return activeFocusSession
}

export function getFocusHistory(): FocusSession[] {
  return (store.get('focusHistory') as FocusSession[]) ?? []
}

export function initFocusManager(): void {
  onWindowChange(handleWindowChange)
  log.info('[focus] Manager initialized')
}