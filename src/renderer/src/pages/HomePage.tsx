import { useEffect, useState } from 'react'
import type { ActiveSession, Stats } from '../../../preload/index.d'

function HomePage(): JSX.Element {
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
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

  // Live counter while playing
  useEffect(() => {
    if (!session) return
    const interval = setInterval(() => forceUpdate((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [session])

  const liveDuration = session
    ? Math.floor((Date.now() - session.startedAt) / 1000)
    : 0
  const todaySeconds = (stats?.today_seconds ?? 0) + liveDuration

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Welcome back</h1>
        <p className="text-white/50">Here&apos;s your gaming summary for today</p>
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
          value={formatDurationShort(stats?.total_seconds ?? 0)}
          trend={`${stats?.total_sessions ?? 0} sessions`}
        />
        <StatCard
          label="Avg session"
          value={formatDurationShort(Math.round(stats?.avg_seconds ?? 0))}
          trend="Keep it healthy"
        />
      </div>

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

function StatCard({ label, value, trend }: StatCardProps): JSX.Element {
  return (
    <div className="bg-bg-panel border border-white/5 rounded-xl p-5">
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">{label}</div>
      <div className="text-2xl font-bold mb-1">{value}</div>
      <div className="text-xs text-white/50">{trend}</div>
    </div>
  )
}

export default HomePage