import { useEffect, useState } from 'react'
import type { FocusSession } from '../../../preload/index.d'

const PLAN_OPTIONS = [
  { label: '25 min', value: 25, desc: 'Pomodoro' },
  { label: '45 min', value: 45, desc: 'Standard' },
  { label: '90 min', value: 90, desc: 'Deep work' },
  { label: 'Untimed', value: 0, desc: 'Free flow' }
]

function FocusModeCard() {
  const [session, setSession] = useState<FocusSession | null>(null)
  const [intent, setIntent] = useState('')
  const [planMinutes, setPlanMinutes] = useState(45)
  const [showReflection, setShowReflection] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    void window.api.focus.getActive().then(setSession)
    const unsub = window.api.focus.onUpdate(setSession)
    return unsub
  }, [])

  // Live counter
  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [session])

  const handleStart = async (): Promise<void> => {
    if (!intent.trim()) return
    await window.api.focus.start(intent.trim(), planMinutes)
    setIntent('')
  }

  const handleEnd = (): void => {
    setShowReflection(true)
  }

  const handleReflection = async (
    r: 'completed' | 'partial' | 'failed'
  ): Promise<void> => {
    await window.api.focus.end(r)
    setShowReflection(false)
  }

  // Reflection modal
  if (showReflection && session) {
    return (
      <div className="bg-bg-panel border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-1">Session complete</h2>
        <p className="text-sm text-white/50 mb-4">
          You worked on: "{session.intent}"
        </p>
        <p className="text-sm font-medium mb-3">Did you finish what you set out to do?</p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handleReflection('completed')}
            className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg py-4 transition-colors flex flex-col items-center gap-1"
          >
            <span className="text-2xl">✅</span>
            <span className="text-xs font-medium">Yes</span>
          </button>
          <button
            onClick={() => handleReflection('partial')}
            className="bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 rounded-lg py-4 transition-colors flex flex-col items-center gap-1"
          >
            <span className="text-2xl">🟡</span>
            <span className="text-xs font-medium">Partially</span>
          </button>
          <button
            onClick={() => handleReflection('failed')}
            className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg py-4 transition-colors flex flex-col items-center gap-1"
          >
            <span className="text-2xl">❌</span>
            <span className="text-xs font-medium">Not really</span>
          </button>
        </div>
      </div>
    )
  }

  // Active session view
  if (session) {
    const elapsedSec = Math.floor((Date.now() - session.startedAt) / 1000)
    const h = Math.floor(elapsedSec / 3600)
    const m = Math.floor((elapsedSec % 3600) / 60)
    const s = elapsedSec % 60
    const timeStr =
      h > 0
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m}:${s.toString().padStart(2, '0')}`

    return (
      <div className="bg-gradient-to-br from-brand-purple/10 to-brand-cyan/10 border border-brand-purple/30 rounded-xl p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs text-brand-cyan uppercase tracking-wider font-medium mb-1">
              🎯 Focus session active
            </div>
            <div className="text-lg font-semibold">{session.intent}</div>
          </div>
          <button
            onClick={handleEnd}
            className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded text-white/70 hover:text-white transition-colors"
          >
            End session
          </button>
        </div>
        <div className="flex items-baseline justify-between mt-4">
          <div className="text-3xl font-mono font-bold text-brand-cyan">{timeStr}</div>
          <div className="text-right">
            <div className="text-xs text-white/40">Drifts</div>
            <div className="text-sm font-medium">{session.drifts.length}</div>
          </div>
        </div>
        {session.plannedMinutes > 0 && (
          <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-purple to-brand-cyan transition-all"
              style={{
                width: `${Math.min(100, (elapsedSec / 60 / session.plannedMinutes) * 100)}%`
              }}
            />
          </div>
        )}
      </div>
    )
  }

  // Start session form
  return (
    <div className="bg-bg-panel border border-white/5 rounded-xl p-6">
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
        🎯 Focus Mode
      </div>
      <h2 className="text-lg font-semibold mb-1">Start a focus session</h2>
      <p className="text-sm text-white/50 mb-4">
        Tell yourself what you want to focus on. We'll quietly track drifts.
      </p>
      <input
        type="text"
        value={intent}
        onChange={(e) => setIntent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleStart()
        }}
        placeholder="e.g. Write the Q3 status email"
        className="w-full bg-bg-elevated border border-white/10 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:border-brand-purple"
      />
      <div className="grid grid-cols-4 gap-2 mb-4">
        {PLAN_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setPlanMinutes(opt.value)}
            className={`rounded-lg py-2.5 text-xs transition-colors border ${
              planMinutes === opt.value
                ? 'bg-brand-purple/20 border-brand-purple/50 text-white'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            <div className="font-medium">{opt.label}</div>
            <div className="text-[10px] text-white/40">{opt.desc}</div>
          </button>
        ))}
      </div>
      <button
        onClick={() => void handleStart()}
        disabled={!intent.trim()}
        className="w-full bg-brand-purple hover:bg-brand-purple/80 disabled:bg-white/5 disabled:text-white/30 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
      >
        Start focus session
      </button>
    </div>
  )
}

export default FocusModeCard