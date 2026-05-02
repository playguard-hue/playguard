import { BrowserWindow, Notification } from 'electron'
import { detectActiveGame, DetectedGame } from './gameDetection'
import { store } from './store'
import { api, UnauthorizedError } from './apiClient'
import {
  onStressEvent,
  startStressMonitoring,
  stopStressMonitoring,
  StressEvent
} from './stressMonitor'
import {
  startKeyboardMonitoring,
  stopKeyboardMonitoring
} from './keyboardMonitor'
import { refreshStreak } from './streakCalculator'

let dailyLimitWarned = false
let sessionLimitWarned = false
let breakReminderLastShown = 0
let hydrationReminderLastShown = 0
let stretchReminderLastShown = 0

const HYDRATION_INTERVAL_MS = 60 * 60 * 1000  // every 60 min
const STRETCH_INTERVAL_MS = 90 * 60 * 1000    // every 90 min

// Smart intervention state
let stressEventsInWindow: number[] = []
const STRESS_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const STRESS_MILD_THRESHOLD = 1
const STRESS_HARD_THRESHOLD = 3
let lastInterventionTime = 0
const INTERVENTION_COOLDOWN_MS = 60 * 1000 // 1 min between interventions

function showNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body, silent: false }).show()
  }
}

function handleStressEvent(event: StressEvent): void {
  if (!activeSession) return

  activeSession.stressEvents.push(event)
  broadcastSessionUpdate()

  const now = Date.now()
  stressEventsInWindow.push(now)
  while (
    stressEventsInWindow.length &&
    now - stressEventsInWindow[0] > STRESS_WINDOW_MS
  ) {
    stressEventsInWindow.shift()
  }

  if (now - lastInterventionTime < INTERVENTION_COOLDOWN_MS) return

  if (stressEventsInWindow.length >= STRESS_HARD_THRESHOLD) {
    lastInterventionTime = now
    showNotification(
      'Maybe step away for 5 minutes?',
      "Multiple stress moments detected. Your KDA isn't worth your peace of mind."
    )
  } else if (stressEventsInWindow.length >= STRESS_MILD_THRESHOLD) {
    lastInterventionTime = now
    showNotification(
      'Take a deep breath',
      "You've got this. Slow inhale for 4, hold for 4, exhale for 4."
    )
  }
}

async function checkLimitWarnings(): Promise<void> {
  if (!activeSession) return

  const settings = store.get('notifications')
  const limits = store.get('limits')
  const sessionMinutes = (Date.now() - activeSession.startedAt) / 1000 / 60

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

  if (settings.limitWarnings && !dailyLimitWarned) {
    try {
      const stats = await api.getStats()
      const todayMinutes = (Number(stats.today_seconds) + sessionMinutes * 60) / 60
      if (todayMinutes >= limits.dailyMinutes) {
        dailyLimitWarned = true
        showNotification(
          'Daily limit reached',
          `You've reached your daily limit of ${limits.dailyMinutes} minutes. Time to do something else!`
        )
      }
    } catch {
      /* ignore */
    }
  }

  // Hydration reminder
  if (settings.hydrationReminders) {
    const sessionStart = activeSession.startedAt
    if (
      Date.now() - sessionStart >= HYDRATION_INTERVAL_MS &&
      Date.now() - hydrationReminderLastShown >= HYDRATION_INTERVAL_MS
    ) {
      hydrationReminderLastShown = Date.now()
      showNotification(
        'Time to hydrate 💧',
        "Take a sip of water. Your brain works better when you're hydrated."
      )
    }
  }

  // Stretch reminder
  if (settings.stretchReminders) {
    const sessionStart = activeSession.startedAt
    if (
      Date.now() - sessionStart >= STRETCH_INTERVAL_MS &&
      Date.now() - stretchReminderLastShown >= STRETCH_INTERVAL_MS
    ) {
      stretchReminderLastShown = Date.now()
      showNotification(
        'Time to stretch 🧘',
        'Stand up and stretch your back, neck, and wrists for a minute.'
      )
    }
  }
}

export interface ActiveSession {
  appId: string
  name: string
  source: string
  startedAt: number
  stressEvents: StressEvent[]
}

export interface CompletedSession extends ActiveSession {
  endedAt: number
  durationSeconds: number
}

interface SessionMeta {
  appId: string
  name: string
  source: string
  startedAt: number
  endedAt?: number
  durationSeconds?: number
}

let activeSession: ActiveSession | null = null
let pollInterval: NodeJS.Timeout | null = null

const POLL_INTERVAL_MS = 5000

function broadcastSessionUpdate(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('session:update', activeSession)
  }
}

function broadcastIntentPrompt(meta: SessionMeta): void {
  const settings = store.get('intent')
  if (!settings.askBeforeSession) return
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('intent:ask-before', meta)
  }
}

function broadcastReflectionPrompt(meta: SessionMeta): void {
  const settings = store.get('intent')
  if (!settings.askAfterSession) return
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('intent:ask-after', meta)
  }
}

async function saveCompletedSession(session: CompletedSession): Promise<void> {
  const existing = (store.get('pendingSessions') as CompletedSession[]) ?? []
  existing.push(session)
  store.set('pendingSessions', existing)

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
        ended_at: new Date(s.endedAt).toISOString(),
        stress_events: s.stressEvents
      })
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        remaining.push(s)
      } else {
        remaining.push(s)
        console.error('[SessionManager] Failed to sync session:', err)
      }
    }
  }

  store.set('pendingSessions', remaining)

  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('stats:invalidated')
  }

  void refreshStreak()
}

function startMonitorsForSession(): void {
  try {
    startStressMonitoring()
    startKeyboardMonitoring()
  } catch (err) {
    console.error('[SessionManager] Failed to start monitors:', err)
  }
}

function stopMonitorsForSession(): void {
  try {
    stopStressMonitoring()
    stopKeyboardMonitoring()
  } catch (err) {
    console.error('[SessionManager] Failed to stop monitors:', err)
  }
}

async function tick(): Promise<void> {
  let detected: DetectedGame | null = null
  try {
    detected = await detectActiveGame()
  } catch (err) {
    console.error('[SessionManager] Detection error:', err)
    return
  }

  // Case 1: nothing playing, nothing was playing
  if (!detected && !activeSession) return

  // Case 2: game just started
  if (detected && !activeSession) {
    activeSession = {
      appId: detected.appId,
      name: detected.name,
      source: detected.source,
      startedAt: Date.now(),
      stressEvents: []
    }
    sessionLimitWarned = false
    breakReminderLastShown = 0
    hydrationReminderLastShown = 0
    stretchReminderLastShown = 0
    stressEventsInWindow = []
    lastInterventionTime = 0
    startMonitorsForSession()
    broadcastSessionUpdate()
    broadcastIntentPrompt({
      appId: activeSession.appId,
      name: activeSession.name,
      source: activeSession.source,
      startedAt: activeSession.startedAt
    })
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
    const closingMeta: SessionMeta = {
      appId: activeSession.appId,
      name: activeSession.name,
      source: activeSession.source,
      startedAt: activeSession.startedAt,
      endedAt: ended,
      durationSeconds: completed.durationSeconds
    }
    activeSession = null
    stopMonitorsForSession()
    broadcastSessionUpdate()
    broadcastReflectionPrompt(closingMeta)
    return
  }

  // Case 5: different game (must come BEFORE Case 4 to take priority)
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
      startedAt: Date.now(),
      stressEvents: []
    }
    hydrationReminderLastShown = 0
    stretchReminderLastShown = 0
    stressEventsInWindow = []
    lastInterventionTime = 0
    broadcastSessionUpdate()
    return
  }

  // Case 4: same game still running
  if (detected && activeSession) {
    void checkLimitWarnings()
  }
}

export function startSessionManager(): void {
  if (pollInterval) return
  onStressEvent(handleStressEvent)
  void tick()
  pollInterval = setInterval(() => void tick(), POLL_INTERVAL_MS)
}

export function stopSessionManager(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  stopMonitorsForSession()
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

/**
 * Force-save the currently active session as completed.
 * Used when app is shutting down — we don't want to lose unsynced playtime.
 */
export async function flushActiveSession(): Promise<void> {
  if (!activeSession) return
  const ended = Date.now()
  const completed: CompletedSession = {
    ...activeSession,
    endedAt: ended,
    durationSeconds: Math.round((ended - activeSession.startedAt) / 1000)
  }
  // Save synchronously to local store first (most important)
  const existing = (store.get('pendingSessions') as CompletedSession[]) ?? []
  existing.push(completed)
  store.set('pendingSessions', existing)
  activeSession = null
}

export { syncPendingSessions }