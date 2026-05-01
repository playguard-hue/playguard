import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../preload/index.d'
import MicrophoneSelector from '../components/MicrophoneSelector'

function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  // Load settings on mount
  useEffect(() => {
    window.api.settings.getAll().then(setSettings)
  }, [])

  // Helper to update a setting and persist it
  const update = async <S extends keyof AppSettings>(
    section: S,
    key: keyof AppSettings[S],
    value: AppSettings[S][keyof AppSettings[S]]
  ): Promise<void> => {
    // Special case: launch-on-startup needs OS-level registration
    if (section === 'app' && key === 'launchOnStartup') {
      await window.api.app.setLaunchOnStartup(value as boolean)
    }
    const updated = await window.api.settings.set(section, key as string, value)
    setSettings(updated)
  }

  if (!settings) {
    return (
      <div className="p-8 text-white/40">Loading settings...</div>
    )
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
          <Row label="Limit warnings">
            <Toggle
              on={settings.notifications.limitWarnings}
              onChange={(v) => update('notifications', 'limitWarnings', v)}
            />
          </Row>
          <Row label="Break reminders">
            <Toggle
              on={settings.notifications.breakReminders}
              onChange={(v) => update('notifications', 'breakReminders', v)}
            />
          </Row>
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
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
        {description && (
          <div className="text-xs text-white/40 mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function Toggle({
  on,
  onChange
}: {
  on: boolean
  onChange: (v: boolean) => void
}) {
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