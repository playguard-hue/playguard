import { useEffect, useState } from 'react'
import type { AppSettings, AppCategoryEntry, AppCategoryValue, SubscriptionInfo } from '../../../preload/index.d'
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
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [showCancelWarning, setShowCancelWarning] = useState(false)

  // Load settings on mount
  useEffect(() => {
    window.api.settings.getAll().then(setSettings)
    void window.api.appCategories.getAll().then(setAppCategories).catch(() => undefined)
    void window.api.subscription.get().then((res) => {
      if (res.data) setSubscription(res.data)
    })
  }, [])

  const handleUpgrade = async (): Promise<void> => {
    setCheckoutLoading(true)
    await window.api.subscription.checkout()
    setCheckoutLoading(false)
  }
  const handleOpenPortal = async (): Promise<void> => {
    setPortalLoading(true)
    setShowCancelWarning(false)
    await window.api.subscription.portal()
    setPortalLoading(false)
  }

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
        {/* Subscription */}
        <div className="bg-gradient-to-br from-brand-purple/20 to-brand-cyan/10 border border-brand-purple/40 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-xs uppercase tracking-wider text-brand-cyan font-medium">
            Subscription
          </div>
          <div className="p-5">
            {subscription?.status === 'active' ? (
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">⭐</span>
                      <span className="font-semibold">PlayGuard Premium</span>
                    </div>
                    <div className="text-xs text-white/50">
                      Your subscription is active{subscription.current_period_end ? ` until ${new Date(subscription.current_period_end).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <div className="text-xs px-3 py-1.5 rounded-full bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30">
                    ACTIVE
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowCancelWarning(true)}
                    className="text-xs text-white/50 hover:text-white/80 underline transition-colors"
                  >
                    Manage subscription
                  </button>
                  <span className="text-white/20 text-xs">·</span>
                  <LegalLinks />
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="font-semibold mb-1">Upgrade to Premium</div>
                    <div className="text-xs text-white/50 mb-3">
                      Unlock premium achievements, custom challenges, and AI companion.
                    </div>
                    <div className="text-xs text-white/40">$4.99 / month</div>
                  </div>
                  <button
                    onClick={() => void handleUpgrade()}
                    disabled={checkoutLoading}
                    className="text-sm px-5 py-2.5 rounded-lg bg-brand-purple hover:bg-brand-purple/80 font-medium transition-colors disabled:opacity-50"
                  >
                    {checkoutLoading ? 'Loading...' : 'Upgrade'}
                  </button>
                </div>
                <p className="text-xs text-white/30">
                  By subscribing you agree to our{' '}
                  <LegalLink href="https://playguard.net/terms.html">Terms of Service</LegalLink>
                  {' '}and{' '}
                  <LegalLink href="https://playguard.net/privacy.html">Privacy Policy</LegalLink>.
                </p>
              </div>
            )}
          </div>
        </div>

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

      {showCancelWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-6">
          <div className="bg-bg-panel border border-white/10 rounded-xl max-w-md w-full p-6">
            <div className="text-4xl mb-3">⚠️</div>
            <div className="text-xl font-bold mb-2">Before you go...</div>
            <div className="text-sm text-white/60 mb-5 space-y-2">
              <p>If you cancel your subscription, you'll lose access to:</p>
              <ul className="list-disc list-inside space-y-1 text-white/50 text-xs ml-2">
                <li>Premium achievements</li>
                <li>Custom challenges</li>
                <li>AI companion (coming soon)</li>
                <li>Advanced analytics (coming soon)</li>
              </ul>
              <p className="text-xs text-white/40 pt-2">
                You'll keep Premium until the end of your current billing period. Your stats and history are never deleted.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelWarning(false)}
                className="flex-1 text-sm px-4 py-2.5 rounded-lg bg-brand-purple hover:bg-brand-purple/80 font-medium transition-colors"
              >
                Keep Premium
              </button>
              <button
                onClick={() => void handleOpenPortal()}
                disabled={portalLoading}
                className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-white/70 transition-colors disabled:opacity-50"
              >
                {portalLoading ? 'Opening...' : 'Continue to portal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Opens URLs in the system browser via Electron shell
function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    window.api.shell?.openExternal(href)
  }
  return (
    <a
      href={href}
      onClick={handleClick}
      className="text-white/40 hover:text-white/70 underline underline-offset-2 transition-colors cursor-pointer"
    >
      {children}
    </a>
  )
}

// Inline legal links used next to "Manage subscription"
function LegalLinks() {
  return (
    <span className="text-xs text-white/30 flex items-center gap-2">
      <LegalLink href="https://playguard.net/terms.html">Terms</LegalLink>
      <span className="text-white/20">·</span>
      <LegalLink href="https://playguard.net/privacy.html">Privacy</LegalLink>
    </span>
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
