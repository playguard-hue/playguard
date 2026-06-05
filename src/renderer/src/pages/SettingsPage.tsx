import { useEffect, useState } from 'react'
import type { AppSettings, AppCategoryEntry, AppCategoryValue } from '../../../preload/index.d'
import MicrophoneSelector from '../components/MicrophoneSelector'

const CATEGORY_LABELS: Record<AppCategoryValue, string> = {
  work: '💼 Work',
  communication: '💬 Communication',
  email: '✉️ Email',
  browser: '🌐 Browser',
  design: '🎨 Design',
  meetings: '📞 Meetings',
  media: '🎬 Media',
  games: '🎮 Games',
  system: '🖥️ System',
  other: '❔ Other'
}

const CATEGORY_OPTIONS: AppCategoryValue[] = [
  'work',
  'communication',
  'email',
  'browser',
  'design',
  'meetings',
  'media',
  'games',
  'system',
  'other'
]

function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [appCategories, setAppCategories] = useState<AppCategoryEntry[]>([])

  // Load settings on mount
  useEffect(() => {
    window.api.settings.getAll().then(setSettings)
    void window.api.appCategories.getAll().then(setAppCategories).catch(() => undefined)
  }, [])

  // Helper to update a setting and persist it
  const update = async <S extends keyof AppSettings>(
    section: S,
    key: keyof AppSettings[S],
    value: AppSettings[S][keyof AppSettings[S]]
  ): Promise<void> => {
    if (section === 'app' && key === 'launchOnStartup') {
      await window.api.app.setLaunchOnStartup(value as boolean)
    }
    const updated = await window.api.settings.set(section, key as string, value)
    setSettings(updated)
  }

  const handleCategoryChange = async (
    exeName: string,
    category: AppCategoryValue
  ): Promise<void> => {
    await window.api.appCategories.set(exeName, category)
    setAppCategories((prev) =>
      prev.map((entry) =>
        entry.exeName === exeName ? { ...entry, category } : entry
      )
    )
  }

  if (!settings) {
    return <div className="p-8 text-white/40">Loading settings...</div>
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Settings</h1>
        <p className="text-white/50">Configure PlayGuard to your preference</p>
      </header>

      <div className="space-y-6 max-w-2xl">
        <Section title="Audio">
          <Row label="Microphone" description="Used for stress detection during gameplay">
            <MicrophoneSelector
              selectedId={settings.audio.microphoneId}
              onChange={(id) => update('audio', 'microphoneId', id)}
            />
          </Row>
          <Row label="Stress detection" description="Analyze voice for signs of frustration">
            <Toggle
              on={settings.audio.stressDetection}
              onChange={(v) => update('audio', 'stressDetection', v)}
            />
          </Row>
        </Section>

        <Section title="Application">
          <Row label="Launch on Windows startup">
            <Toggle
              on={settings.app.launchOnStartup}
              onChange={(v) => update('app', 'launchOnStartup', v)}
            />
          </Row>
          <Row label="Minimize to tray on close">
            <Toggle
              on={settings.app.minimizeToTray}
              onChange={(v) => update('app', 'minimizeToTray', v)}
            />
          </Row>
        </Section>

        <Section title="Notifications">
          <Row label="Limit warnings" description="Alerts when you exceed daily or session limits">
            <Toggle
              on={settings.notifications.limitWarnings}
              onChange={(v) => update('notifications', 'limitWarnings', v)}
            />
          </Row>
          <Row label="Break reminders" description="Suggest taking a break every so often">
            <Toggle
              on={settings.notifications.breakReminders}
              onChange={(v) => update('notifications', 'breakReminders', v)}
            />
          </Row>
          <Row label="Hydration reminders 💧" description="Drink water every 60 minutes during a session">
            <Toggle
              on={settings.notifications.hydrationReminders}
              onChange={(v) => update('notifications', 'hydrationReminders', v)}
            />
          </Row>
          <Row label="Stretch reminders 🧘" description="Stand up and stretch every 90 minutes">
            <Toggle
              on={settings.notifications.stretchReminders}
              onChange={(v) => update('notifications', 'stretchReminders', v)}
            />
          </Row>
        </Section>

        {/* App Categories — for Focus Mode */}
        <div className="bg-bg-panel border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-xs uppercase tracking-wider text-white/40 font-medium flex items-center justify-between">
            <span>App categories</span>
            <span className="text-white/30 normal-case text-[10px]">
              For Focus Mode drift detection
            </span>
          </div>
          <div className="px-5 py-3 text-xs text-white/50 leading-relaxed border-b border-white/5">
            Categorize how each app counts during focus sessions. Apps in{' '}
            <span className="text-white/70 font-medium">Communication</span>,{' '}
            <span className="text-white/70 font-medium">Media</span>, and{' '}
            <span className="text-white/70 font-medium">Games</span> categories will be flagged as
            distractions.
          </div>
          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
            {appCategories.map((entry) => (
              <div
                key={entry.exeName}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{entry.appName}</div>
                  <div className="text-[10px] text-white/30 font-mono">{entry.exeName}</div>
                </div>
                <select
                  value={entry.category}
                  onChange={(e) =>
                    void handleCategoryChange(entry.exeName, e.target.value as AppCategoryValue)
                  }
                  className="bg-bg-elevated border border-white/10 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-brand-purple cursor-pointer"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg-panel border border-white/5 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5 text-xs uppercase tracking-wider text-white/40 font-medium">
        {title}
      </div>
      <div className="divide-y divide-white/5">{children}</div>
    </div>
  )
}

function Row({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {description && <div className="text-xs text-white/40 mt-0.5">{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
        on ? 'bg-brand-purple' : 'bg-white/10'
      }`}
    >
      <div
        className={`w-5 h-5 bg-white rounded-full transition-transform ${
          on ? 'translate-x-4' : ''
        }`}
      />
    </button>
  )
}

export default SettingsPage