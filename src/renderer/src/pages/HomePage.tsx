import { useEffect, useState } from 'react'
import type { ActiveSession, Stats, User, AppSettings } from '../../../preload/index.d'
import { buildGreeting } from '../utils/greetings'

function HomePage() {
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [streak, setStreak] = useState<{ currentDays: number; longestDays: number } | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [dailyLimit, setDailyLimit] = useState(120)
  const [, forceUpdate] = useState(0)

  // Subscribe to active session
  useEffect(() => {
    void window.api.session.getActive().then(setSession)
    const unsub = window.api.session.onUpdate(setSession)
    return unsub
  }, [])

  // Load stats and re-load when invalidated
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        const s = await window.api.stats.get()
        setStats(s)
      } catch (err) {
        console.error('Failed to load stats', err)
      }
    }
    void load()
    const unsub = window.api.stats.onInvalidated(load)
    return unsub
  }, [])

  // Load streak
  useEffect(() => {
    void window.api.streak.get().then(setStreak).catch(() => undefined)
    const unsub = window.api.stats.onInvalidated(() => {
      void window.api.streak.get().then(setStreak).catch(() => undefined)
    })
    return unsub
  }, [])

  // Load user + daily limit (used by greeting)
  useEffect(() => {
    void window.api.auth.getCurrentUser().then(setUser).catch(() => undefined)
    void window.api.settings.getAll().then((s: AppSettings) => {
      setDailyLimit(s.limits.dailyMinutes)
    }).catch(() => undefined)
  }, [])

  // Live counter while playing
  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => forceUpdate((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [session])

  const liveDuration = session
    ? Math.floor((Date.now() - session.startedAt) / 1000)
    : 0
  const todaySeconds = Number(stats?.today_seconds ?? 0) + liveDuration

  const greeting = buildGreeting({
    user,
    session,
    stats,
    streak,
    dailyLimitMinutes: dailyLimit
  })

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">{greeting.title}</h1>
        <p className="text-white/50">{greeting.subtitle}</p>
      </header>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Today"
          value={formatDurationShort(todaySeconds)}
          trend={session ? 'Counting now…' : 'No active session'}
        />
        <StatCard
          label="All time"
          value={formatDurationShort(Number(stats?.total_seconds ?? 0))}
          trend={`${stats?.total_sessions ?? 0} sessions`}
        />
        <StatCard
          label="Avg session"
          value={formatDurationShort(Math.round(Number(stats?.avg_seconds ?? 0)))}
          trend="Keep it healthy"
        />
      </div>

      {/* Streak banner */}
      {streak && streak.currentDays > 0 && (
        <div className="bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-xl p-5 mb-8 flex items-center gap-4">
          <div className="text-4xl">🔥</div>
          <div className="flex-1">
            <div className="text-lg font-bold">
              {streak.currentDays}-day healthy streak
            </div>
            <div className="text-sm text-white/60">
              {streak.currentDays === 1
                ? 'Stay within your daily limit tomorrow to keep it going.'
                : streak.longestDays > streak.currentDays
                  ? `Your longest is ${streak.longestDays} days — keep going!`
                  : "You're on your longest streak ever!"}
            </div>
          </div>
        </div>
      )}

      {/* Current session */}
      <div className="bg-bg-panel border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Current session</h2>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              session
                ? 'bg-green-500/20 text-green-400'
                : 'bg-white/5 text-white/50'
            }`}
          >
            {session ? '● Live' : 'Idle'}
          </span>
        </div>

        {session ? (
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-2xl font-bold mb-1">{session.name}</div>
              <div className="text-sm text-white/50">
                Detected via {session.source}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-mono font-bold text-brand-cyan">
                {formatDurationLive(liveDuration)}
              </div>
              <div className="text-xs text-white/40 mt-0.5">elapsed</div>
            </div>
          </div>
        ) : (
          <p className="text-white/50 text-sm">
            No active game detected. PlayGuard will start tracking automatically when you launch a game.
          </p>
        )}
      </div>
    </div>
  )
}

function formatDurationShort(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}

function formatDurationLive(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface StatCardProps {
  label: string
  value: string
  trend: string
}

function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <div className="bg-bg-panel border border-white/5 rounded-xl p-5">
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs text-white/50">{trend}</div>
    </div>
  )
}

export default HomePage