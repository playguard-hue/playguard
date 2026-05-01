import { BrowserWindow } from 'electron'
import { detectActiveGame, DetectedGame } from './gameDetection'
import { store } from './store'
import { api, UnauthorizedError } from './apiClient'
import { Notification } from 'electron' 
let dailyLimitWarned = false
let sessionLimitWarned = false
let breakReminderLastShown = 0

function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show()
  }
}

async function checkLimitWarnings(): Promise<void> {
  if (!activeSession) return

  const settings = store.get('notifications')
  const limits = store.get('limits')
  const sessionMinutes = (Date.now() - activeSession.startedAt) / 1000 / 60

  // Session-length warning (one-shot per session)
  if (
    settings.limitWarnings &&
    !sessionLimitWarned &&
    sessionMinutes >= limits.sessionMinutes
  ) {
    sessionLimitWarned = true
    showNotification(
      'Long session detected',
      `You've been playing ${activeSession.name} for ${Math.round(sessionMinutes)} minutes. Consider taking a break.`
    )
  }

  // Break reminder (recurring)
  if (settings.breakReminders) {
    const intervalMs = limits.breakIntervalMinutes * 60 * 1000
    if (
      breakReminderLastShown === 0 ||
      Date.now() - breakReminderLastShown >= intervalMs
    ) {
      if (sessionMinutes >= limits.breakIntervalMinutes) {
        breakReminderLastShown = Date.now()
        showNotification(
          'Time for a break!',
          'Stand up, stretch, drink some water. Your eyes will thank you.'
        )
      }
    }
  }

  // Daily limit warning (one-shot per day, but we don't reset across days yet — TODO)
  if (settings.limitWarnings && !dailyLimitWarned) {
    try {
      const stats = await api.getStats()
      const todayMinutes = (stats.today_seconds + sessionMinutes * 60) / 60
      if (todayMinutes >= limits.dailyMinutes) {
        dailyLimitWarned = true
        showNotification(
          'Daily limit reached',
          `You've reached your daily limit of ${limits.dailyMinutes} minutes. Time to do something else!`
        )
      }
    } catch {
      // Backend unreachable — skip silently
    }
  }
}

export interface ActiveSession {
  appId: string
  name: string
  source: string
  startedAt: number // unix ms
}

export interface CompletedSession extends ActiveSession {
  endedAt: number
  durationSeconds: number
}

let activeSession: ActiveSession | null = null
let pollInterval: NodeJS.Timeout | null = null

const POLL_INTERVAL_MS = 5000 // check for game every 5 seconds

/**
 * Notify all open windows that the session state changed.
 */
function broadcastSessionUpdate(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('session:update', activeSession)
  }
}

/**
 * Save a completed session to local storage (will sync to backend later).
 */
async function saveCompletedSession(session: CompletedSession): Promise<void> {
  // Always save locally first (in case backend is down)
  const existing = (store.get('pendingSessions') as CompletedSession[]) ?? []
  existing.push(session)
  store.set('pendingSessions', existing)

  // Try to sync immediately
  await syncPendingSessions()
}

async function syncPendingSessions(): Promise<void> {
  const pending = (store.get('pendingSessions') as CompletedSession[]) ?? []
  if (pending.length === 0) return

  const remaining: CompletedSession[] = []

  for (const s of pending) {
    try {
      await api.postSession({
        game: s.name,
        duration_seconds: s.durationSeconds,
        started_at: new Date(s.startedAt).toISOString(),
        ended_at: new Date(s.endedAt).toISOString()
      })
      // Success — don't keep this one
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        // Not logged in — keep all sessions for later
        remaining.push(s)
      } else {
        // Network error or server issue — keep for retry
        remaining.push(s)
        console.error('[SessionManager] Failed to sync session:', err)
      }
    }
  }

  store.set('pendingSessions', remaining)

  // Notify UI that stats may have changed
  const { BrowserWindow } = await import('electron')
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('stats:invalidated')
  }
}

/**
 * Run one detection tick. Compares current state to previous state.
 */
async function tick(): Promise<void> {
  let detected: DetectedGame | null = null
  try {
    detected = await detectActiveGame()
  } catch (err) {
    console.error('[SessionManager] Detection error:', err)
    return
  }

  // Case 1: nothing playing, nothing was playing → no-op
  if (!detected && !activeSession) return

  // Case 2: game just started
  if (detected && !activeSession) {
    activeSession = {
      appId: detected.appId,
      name: detected.name,
      source: detected.source,
      startedAt: Date.now()
    }
    sessionLimitWarned = false
    breakReminderLastShown = 0
    broadcastSessionUpdate()
    return
  }

  // Case 3: game just stopped
  if (!detected && activeSession) {
    const ended = Date.now()
    const completed: CompletedSession = {
      ...activeSession,
      endedAt: ended,
      durationSeconds: Math.round((ended - activeSession.startedAt) / 1000)
    }
    void saveCompletedSession(completed)
    sessionLimitWarned = false
    activeSession = null
    broadcastSessionUpdate()
    return
  }

  // Case 4: same game still running → check limit warnings
  if (detected && activeSession) {
    void checkLimitWarnings()
    return
  }
  // Case 5: different game! End previous, start new.
  if (
    detected &&
    activeSession &&
    detected.appId !== activeSession.appId
  ) {
    const ended = Date.now()
    const completed: CompletedSession = {
      ...activeSession,
      endedAt: ended,
      durationSeconds: Math.round((ended - activeSession.startedAt) / 1000)
    }
    void saveCompletedSession(completed)

    activeSession = {
      appId: detected.appId,
      name: detected.name,
      source: detected.source,
      startedAt: Date.now()
    }
    broadcastSessionUpdate()
  }
}

export function startSessionManager(): void {
  if (pollInterval) return // already running
  void tick() // run immediately
  pollInterval = setInterval(() => void tick(), POLL_INTERVAL_MS)
}

export function stopSessionManager(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

export function getActiveSession(): ActiveSession | null {
  return activeSession
}

export function getPendingSessions(): CompletedSession[] {
  return (store.get('pendingSessions') as CompletedSession[]) ?? []
}

export function clearPendingSessions(): void {
store.set('pendingSessions', [])
}

export { syncPendingSessions }