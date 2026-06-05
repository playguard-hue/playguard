import { useEffect, useState } from 'react'
import type { FocusSession, DailyIntentData, AppSettings } from '../../../preload/index.d'
import FocusModeCard from '../components/FocusModeCard'

function FocusPage() {
  const [history, setHistory] = useState<FocusSession[]>([])
  const [dailyIntent, setDailyIntent] = useState<DailyIntentData | null>(null)
  const [showIntentEditor, setShowIntentEditor] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    void window.api.focus.getHistory().then(setHistory).catch(() => undefined)
    void window.api.dailyIntent.get().then(setDailyIntent).catch(() => undefined)

    // Show banner unless user has dismissed it
    void window.api.settings
      .getAll()
      .then((s: AppSettings) => {
        if (!s.ui.focusBannerDismissed) {
          setShowBanner(true)
        }
      })
      .catch(() => undefined)

    // Refresh history when session changes
    const unsub = window.api.focus.onUpdate(() => {
      void window.api.focus.getHistory().then(setHistory).catch(() => undefined)
    })
    return unsub
  }, [])

  const handleDismissBanner = async (): Promise<void> => {
    await window.api.settings.set('ui', 'focusBannerDismissed', true)
    setShowBanner(false)
  }

  const today = new Date().toISOString().slice(0, 10)
  const hasTodayIntent = dailyIntent?.date === today && dailyIntent.priority

  const todayFocusSessions = history.filter((s) => {
    const sessionDay = new Date(s.startedAt).toISOString().slice(0, 10)
    return sessionDay === today
  })

  const totalTodayMinutes = todayFocusSessions.reduce((sum, s) => {
    const duration = (s.endedAt ?? Date.now()) - s.startedAt
    return sum + Math.floor(duration / 60000)
  }, 0)

  return (
    <div className="p-8">
      <header className="mb-6">
        <h1 className="text-3xl font-bold mb-1">Focus Mode</h1>
        <p className="text-white/50">Protect your attention from context-switching.</p>
      </header>

      {/* Welcome / explainer banner */}
      {showBanner && (
        <div className="bg-gradient-to-br from-brand-purple/10 to-brand-cyan/5 border border-brand-purple/20 rounded-xl p-5 mb-6 relative">
          <button
            onClick={() => void handleDismissBanner()}
            className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-white/40 hover:text-white hover:bg-white/5 transition-colors"
            title="Got it, hide this"
          >
            ✕
          </button>
          <div className="flex items-start gap-4 pr-8">
            <div className="text-3xl">🎯</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold mb-1">What is Focus Mode?</div>
              <p className="text-sm text-white/60 leading-relaxed">
                Started a task and 3 hours later realized you've been replying to messages,
                checking email, and switching tabs instead? Focus Mode helps you stay on one thing.
                Set an intention, work, and we'll quietly notice when you drift — no blocking, no
                shame, just awareness. Perfect for emails, writing, deep work, coding, or anything
                that needs your full attention.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Daily Intent — optional */}
      <div className="mb-6">
        {hasTodayIntent && !showIntentEditor ? (
          <div className="bg-gradient-to-r from-brand-cyan/10 to-brand-purple/10 border border-brand-cyan/20 rounded-xl p-5 flex items-center gap-4">
            <div className="text-3xl">☀️</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wider text-brand-cyan font-medium mb-0.5">
                Today's priority
              </div>
              <div className="font-medium truncate">{dailyIntent.priority}</div>
            </div>
            <button
              onClick={() => setShowIntentEditor(true)}
              className="text-xs text-white/40 hover:text-white px-3 py-1.5 rounded hover:bg-white/5"
            >
              Edit
            </button>
          </div>
        ) : (
          <DailyIntentEditor
            current={dailyIntent}
            onSave={(d) => {
              setDailyIntent(d)
              setShowIntentEditor(false)
            }}
            onCancel={hasTodayIntent ? () => setShowIntentEditor(false) : undefined}
          />
        )}
      </div>

      {/* Focus Mode Card */}
      <div className="mb-6">
        <FocusModeCard />
      </div>

      {/* Today's stats */}
      {todayFocusSessions.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MiniStat label="Sessions today" value={todayFocusSessions.length.toString()} />
          <MiniStat
            label="Focus minutes"
            value={`${Math.floor(totalTodayMinutes / 60)}h ${totalTodayMinutes % 60}m`}
          />
          <MiniStat
            label="Drifts today"
            value={todayFocusSessions.reduce((sum, s) => sum + s.drifts.length, 0).toString()}
          />
        </div>
      )}

      {/* Recent history */}
      {history.length > 0 && (
        <div className="bg-bg-panel border border-white/5 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5 text-xs uppercase tracking-wider text-white/40 font-medium">
            Recent sessions
          </div>
          <div className="divide-y divide-white/5">
            {history
              .slice()
              .reverse()
              .slice(0, 10)
              .map((s) => (
                <HistoryRow key={s.id} session={s} />
              ))}
          </div>
        </div>
      )}

      {history.length === 0 && (
        <div className="text-center py-12 text-white/30 text-sm">
          No focus sessions yet. Start your first one above.
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg-panel border border-white/5 rounded-xl p-4">
      <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
}

function HistoryRow({ session }: { session: FocusSession }) {
  const duration = (session.endedAt ?? Date.now()) - session.startedAt
  const minutes = Math.floor(duration / 60000)
  const startTime = new Date(session.startedAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
  const startDate = new Date(session.startedAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  })

  const reflectionIcon =
    session.reflection === 'completed'
      ? '✅'
      : session.reflection === 'partial'
        ? '🟡'
        : session.reflection === 'failed'
          ? '❌'
          : '⏱'

  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <div className="text-xl">{reflectionIcon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{session.intent || '(no intent)'}</div>
        <div className="text-xs text-white/40">
          {startDate} • {startTime} • {minutes} min
          {session.drifts.length > 0 && ` • ${session.drifts.length} drifts`}
        </div>
      </div>
    </div>
  )
}

interface DailyIntentEditorProps {
  current: DailyIntentData | null
  onSave: (data: DailyIntentData) => void
  onCancel?: () => void
}

function DailyIntentEditor({ current, onSave, onCancel }: DailyIntentEditorProps) {
  const today = new Date().toISOString().slice(0, 10)
  const isToday = current?.date === today

  const [priority, setPriority] = useState(isToday ? (current?.priority ?? '') : '')
  const [energy, setEnergy] = useState<'low' | 'normal' | 'high'>(
    isToday ? (current?.energy ?? 'normal') : 'normal'
  )
  const [budgetMinutes, setBudgetMinutes] = useState(
    isToday ? (current?.gamingBudgetMinutes ?? 60) : 60
  )

  const handleSave = async (): Promise<void> => {
    const data = await window.api.dailyIntent.set(priority.trim(), energy, budgetMinutes)
    onSave(data)
  }

  return (
    <div className="bg-bg-panel border border-white/5 rounded-xl p-6">
      <div className="text-xs text-brand-cyan uppercase tracking-wider mb-2">
        ☀️ Daily intent (optional)
      </div>
      <h2 className="text-lg font-semibold mb-1">Set your focus for today</h2>
      <p className="text-sm text-white/50 mb-4">A morning ritual to anchor your day.</p>

      <label className="block text-xs font-medium mb-1.5 text-white/60">Top priority</label>
      <input
        type="text"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        placeholder="e.g. Finish the Q3 report"
        className="w-full bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-brand-purple"
      />

      <label className="block text-xs font-medium mb-1.5 text-white/60">Energy level</label>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(['low', 'normal', 'high'] as const).map((v) => {
          const meta = { low: '😴', normal: '🙂', high: '⚡' }[v]
          return (
            <button
              key={v}
              onClick={() => setEnergy(v)}
              className={`rounded-lg py-2.5 transition-colors flex flex-col items-center gap-0.5 border ${
                energy === v
                  ? 'bg-brand-purple/20 border-brand-purple/50'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <span className="text-xl">{meta}</span>
              <span className="text-[10px] capitalize">{v}</span>
            </button>
          )
        })}
      </div>

      <label className="block text-xs font-medium mb-1.5 text-white/60">
        Gaming budget today: {Math.floor(budgetMinutes / 60)}h {budgetMinutes % 60}m
      </label>
      <input
        type="range"
        min={0}
        max={300}
        step={15}
        value={budgetMinutes}
        onChange={(e) => setBudgetMinutes(parseInt(e.target.value, 10))}
        className="w-full mb-5 accent-brand-purple"
      />

      <div className="flex gap-2">
        <button
          onClick={() => void handleSave()}
          disabled={!priority.trim()}
          className="flex-1 bg-brand-purple hover:bg-brand-purple/80 disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors text-sm"
        >
          Save
        </button>
        {onCancel && (
          <button onClick={onCancel} className="px-4 text-xs text-white/40 hover:text-white/60">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

export default FocusPage