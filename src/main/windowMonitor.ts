import activeWindow from 'active-win'
import log from 'electron-log/main'
import { store } from './store'

export interface WindowInfo {
  title: string
  appName: string  // Display name e.g. "Microsoft Teams"
  exeName: string  // e.g. "teams.exe"
  category: AppCategory
}

export type AppCategory =
  | 'work'        // Office apps, IDEs
  | 'communication' // Slack, Teams, Discord
  | 'email'       // Outlook
  | 'browser'     // Chrome, Edge, Firefox
  | 'design'      // Figma, Photoshop
  | 'meetings'    // Zoom, Webex
  | 'media'       // YouTube, Netflix (when in browser detected by title)
  | 'games'       // Detected by gameDetection separately
  | 'system'      // Explorer, Settings, etc.
  | 'other'

// Map executable names (lowercase) → friendly display name + category
const APP_REGISTRY: Record<string, { name: string; category: AppCategory }> = {
  // Office / Work
  'excel.exe': { name: 'Excel', category: 'work' },
  'winword.exe': { name: 'Word', category: 'work' },
  'powerpnt.exe': { name: 'PowerPoint', category: 'work' },
  'onenote.exe': { name: 'OneNote', category: 'work' },
  'notion.exe': { name: 'Notion', category: 'work' },
  'obsidian.exe': { name: 'Obsidian', category: 'work' },

  // Communication
  'teams.exe': { name: 'Microsoft Teams', category: 'communication' },
  'ms-teams.exe': { name: 'Microsoft Teams', category: 'communication' },
  'slack.exe': { name: 'Slack', category: 'communication' },
  'discord.exe': { name: 'Discord', category: 'communication' },
  'whatsapp.exe': { name: 'WhatsApp', category: 'communication' },
  'telegram.exe': { name: 'Telegram', category: 'communication' },
  'skype.exe': { name: 'Skype', category: 'communication' },

  // Email
  'outlook.exe': { name: 'Outlook', category: 'email' },
  'thunderbird.exe': { name: 'Thunderbird', category: 'email' },

  // Browser
  'chrome.exe': { name: 'Chrome', category: 'browser' },
  'msedge.exe': { name: 'Edge', category: 'browser' },
  'firefox.exe': { name: 'Firefox', category: 'browser' },
  'safari.exe': { name: 'Safari', category: 'browser' },
  'brave.exe': { name: 'Brave', category: 'browser' },
  'opera.exe': { name: 'Opera', category: 'browser' },

  // Code / IDE
  'code.exe': { name: 'VS Code', category: 'work' },
  'idea64.exe': { name: 'IntelliJ', category: 'work' },
  'devenv.exe': { name: 'Visual Studio', category: 'work' },
  'sublime_text.exe': { name: 'Sublime Text', category: 'work' },
  'cursor.exe': { name: 'Cursor', category: 'work' },

  // Design
  'figma.exe': { name: 'Figma', category: 'design' },
  'photoshop.exe': { name: 'Photoshop', category: 'design' },
  'illustrator.exe': { name: 'Illustrator', category: 'design' },

  // Meetings
  'zoom.exe': { name: 'Zoom', category: 'meetings' },
  'cptHost.exe': { name: 'Webex', category: 'meetings' },

  // Media / Entertainment
  'spotify.exe': { name: 'Spotify', category: 'media' },
  'vlc.exe': { name: 'VLC', category: 'media' },
  'netflix.exe': { name: 'Netflix', category: 'media' },

  // System
  'explorer.exe': { name: 'File Explorer', category: 'system' },
  'systemsettings.exe': { name: 'Settings', category: 'system' }
}

// Browser tabs are tricky — we try to detect distracting sites from window title
const BROWSER_DISTRACTION_KEYWORDS = [
  'youtube',
  'netflix',
  'twitch',
  'tiktok',
  'reddit',
  'twitter',
  'x.com',
  'facebook',
  'instagram'
]

function classify(exeName: string, title: string): { name: string; category: AppCategory } {
  const lower = exeName.toLowerCase()

  // Check user's custom overrides first
  const customCategories = store.get('customAppCategories') ?? {}
  const customCategory = customCategories[lower]

  const known = APP_REGISTRY[lower]

  if (known) {
    // Browser? Check title for distraction patterns
    if (known.category === 'browser') {
      const titleLower = title.toLowerCase()
      const isDistraction = BROWSER_DISTRACTION_KEYWORDS.some((kw) =>
        titleLower.includes(kw)
      )
      if (isDistraction) {
        return { name: `${known.name} (distraction)`, category: 'media' }
      }
    }
    // Apply custom override if exists
    if (customCategory) {
      return { name: known.name, category: customCategory as AppCategory }
    }
    return known
  }

  // Unknown app — try to extract from exe name
  const friendly = lower
    .replace(/\.exe$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())

  // Apply custom override if exists for unknown app
  if (customCategory) {
    return { name: friendly, category: customCategory as AppCategory }
  }

  return { name: friendly, category: 'other' }
}

let currentWindow: WindowInfo | null = null
let pollInterval: NodeJS.Timeout | null = null

const POLL_INTERVAL_MS = 2000 // every 2 seconds

const windowChangeListeners: Array<(win: WindowInfo | null) => void> = []

export function onWindowChange(
  listener: (win: WindowInfo | null) => void
): () => void {
  windowChangeListeners.push(listener)
  return () => {
    const idx = windowChangeListeners.indexOf(listener)
    if (idx >= 0) windowChangeListeners.splice(idx, 1)
  }
}

function emitChange(win: WindowInfo | null): void {
  for (const listener of windowChangeListeners) {
    try {
      listener(win)
    } catch (err) {
      log.error('[windowMonitor] Listener error:', err)
    }
  }
}

async function tick(): Promise<void> {
  try {
    const win = await activeWindow()
    if (!win) return

    const exeName = (win.owner.path?.split(/[\\/]/).pop() ?? 'unknown').toLowerCase()
    const classified = classify(exeName, win.title)

    const info: WindowInfo = {
      title: win.title,
      appName: classified.name,
      exeName,
      category: classified.category
    }

    const changed =
      !currentWindow ||
      currentWindow.exeName !== info.exeName ||
      currentWindow.title !== info.title

    if (changed) {
      currentWindow = info
      emitChange(info)
    }
  } catch (err) {
    log.error('[windowMonitor] tick error:', err)
  }
}

export function startWindowMonitoring(): void {
  if (pollInterval) return
  log.info('[windowMonitor] Started')
  void tick()
  pollInterval = setInterval(() => void tick(), POLL_INTERVAL_MS)
}

export function stopWindowMonitoring(): void {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
  currentWindow = null
  log.info('[windowMonitor] Stopped')
}

export function getCurrentWindow(): WindowInfo | null {
  return currentWindow
}
export function getRecentAppsSeen(): Array<{ exeName: string; appName: string; category: AppCategory }> {
  // Returns the apps we've seen, for the Settings UI to manage categories
  // For now just return APP_REGISTRY contents as the list user can customize
  const result: Array<{ exeName: string; appName: string; category: AppCategory }> = []
  const customCategories = (store.get('customAppCategories') as Record<string, string>) ?? {}

  for (const [exe, meta] of Object.entries(APP_REGISTRY)) {
    const customCategory = customCategories[exe]
    result.push({
      exeName: exe,
      appName: meta.name,
      category: (customCategory as AppCategory) ?? meta.category
    })
  }
  return result.sort((a, b) => a.appName.localeCompare(b.appName))
}

export function setAppCategory(exeName: string, category: AppCategory): void {
  const customCategories = (store.get('customAppCategories') as Record<string, string>) ?? {}
  const lower = exeName.toLowerCase()
  const defaultMeta = APP_REGISTRY[lower]

  // If user sets it back to default → remove the override
  if (defaultMeta && defaultMeta.category === category) {
    delete customCategories[lower]
  } else {
    customCategories[lower] = category
  }
  store.set('customAppCategories', customCategories)
}