import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import log from 'electron-log/main'
import { store } from './store'

export interface StressEvent {
  timestamp: string
  source: 'voice' | 'keyboard'
  rms?: number
  durationMs?: number
  rate?: number
  key?: string
}

let workerWindow: BrowserWindow | null = null
let workerReady = false
let isMonitoring = false

const stressEventListeners: Array<(event: StressEvent) => void> = []

export function onStressEvent(
  listener: (event: StressEvent) => void
): () => void {
  stressEventListeners.push(listener)
  return () => {
    const idx = stressEventListeners.indexOf(listener)
    if (idx >= 0) stressEventListeners.splice(idx, 1)
  }
}

export function emitStressEvent(event: StressEvent): void {
  log.info('[stress] Event:', event)
  for (const listener of stressEventListeners) {
    try {
      listener(event)
    } catch (err) {
      log.error('[stress] Listener error:', err)
    }
  }
}

function createWorkerWindow(): void {
  if (workerWindow) return

  workerWindow = new BrowserWindow({
    show: false,
    width: 100,
    height: 100,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  // In dev, electron-vite serves HTML files from the dev server.
  // In production, they're built to out/renderer/.
  if (process.env['ELECTRON_RENDERER_URL']) {
    workerWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/audioWorker.html`)
  } else {
    workerWindow.loadFile(join(__dirname, '../renderer/audioWorker.html'))
  }

  workerWindow.on('closed', () => {
    workerWindow = null
    workerReady = false
    isMonitoring = false
  })

  log.info('[stress] Worker window created')
}

export function destroyWorkerWindow(): void {
  if (workerWindow) {
    workerWindow.close()
    workerWindow = null
  }
}

// IPC handlers — register once at startup
export function registerStressIpc(): void {
  ipcMain.on('stress:worker-ready', () => {
    workerReady = true
    log.info('[stress] Worker reported ready')
  })

  ipcMain.on('stress:worker-status', (_e, status) => {
    log.info('[stress] Worker status:', status)
  })

  ipcMain.on('stress:detected', (_e, event: StressEvent) => {
    emitStressEvent(event)
  })
}

export function startStressMonitoring(): void {
  const audio = store.get('audio')
  if (!audio.stressDetection) {
    log.info('[stress] Disabled in audio settings, skipping')
    return
  }

  if (!workerWindow) {
    createWorkerWindow()
  }

  const send = (): void => {
    workerWindow?.webContents.send('stress:start', audio.microphoneId ?? null)
    isMonitoring = true
    log.info('[stress] Voice monitoring started')
  }

  if (workerReady) {
    send()
  } else {
    // Worker not ready yet — wait for it
    const interval = setInterval(() => {
      if (workerReady) {
        clearInterval(interval)
        send()
      }
    }, 100)
    setTimeout(() => clearInterval(interval), 5000)
  }
}

export function stopStressMonitoring(): void {
  if (workerWindow && isMonitoring) {
    workerWindow.webContents.send('stress:stop')
    isMonitoring = false
    log.info('[stress] Voice monitoring stopped')
  }
}

export function isStressMonitoringActive(): boolean {
  return isMonitoring
}