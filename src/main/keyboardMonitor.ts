import { uIOhook } from 'uiohook-napi'
import log from 'electron-log/main'
import { emitStressEvent } from './stressMonitor'
import { store } from './store'

let isHooked = false
let isMonitoring = false

// Sliding window of recent keypress timestamps (ALL keys together)
let recentKeypresses: number[] = []

const RAGE_THRESHOLD_TOTAL = 25  // 25+ keypresses across all keys
const WINDOW_MS = 2000           // ...within a 2-second window
const COOLDOWN_MS = 5000         // Don't fire events more than once per 5 sec
let lastEventTime = 0

function checkRage(): void {
  const now = Date.now()

  recentKeypresses.push(now)
  while (recentKeypresses.length && now - recentKeypresses[0] > WINDOW_MS) {
    recentKeypresses.shift()
  }

  if (
    recentKeypresses.length >= RAGE_THRESHOLD_TOTAL &&
    now - lastEventTime >= COOLDOWN_MS
  ) {
    lastEventTime = now
    log.info('[keyboard] RAGE DETECTED:', recentKeypresses.length, 'keys in', WINDOW_MS, 'ms')
    emitStressEvent({
      timestamp: new Date().toISOString(),
      source: 'keyboard',
      key: 'spam',
      rate: recentKeypresses.length
    })
    recentKeypresses = []
  }
}

function startHook(): void {
  if (isHooked) return

  uIOhook.on('keydown', () => {
    if (!isMonitoring) return
    try {
      checkRage()
    } catch (err) {
      log.error('[keyboard] checkRage error:', err)
    }
  })

  uIOhook.start()
  isHooked = true
  log.info('[keyboard] Global hook started')
}

export function startKeyboardMonitoring(): void {
  const audio = store.get('audio')
  if (!audio.stressDetection) {
    log.info('[keyboard] Disabled in settings, skipping')
    return
  }

  try {
    startHook()
    isMonitoring = true
    recentKeypresses = []
    log.info('[keyboard] Rage monitoring started')
  } catch (err) {
    log.error('[keyboard] Failed to start:', err)
  }
}

export function stopKeyboardMonitoring(): void {
  isMonitoring = false
  recentKeypresses = []
  log.info('[keyboard] Rage monitoring stopped')
}

export function destroyKeyboardHook(): void {
  if (isHooked) {
    try {
      uIOhook.stop()
    } catch (err) {
      log.error('[keyboard] Failed to stop hook:', err)
    }
    isHooked = false
  }
}