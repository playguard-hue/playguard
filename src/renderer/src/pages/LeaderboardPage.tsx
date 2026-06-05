import { useEffect, useState } from 'react'
import type { SubscriptionInfo } from '../../../preload/index.d'

interface LeaderboardEntry {
  username: string
  total_xp: number
  current_level: number
  achievements_count: number
}

function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      window.api.leaderboard.get(),
      window.api.subscription.get()
    ]).then(([lb, sub]) => {
      if (lb.error) setError(lb.error)
      else setEntries(lb.data ?? [])
      if (sub.data) setSubscription(sub.data)
      setLoading(false)
    })
  }, [])

  const isPremium = subscription?.status === 'active'

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Leaderboard</h1>
      <p className="text-white/40 text-sm mb-8">Top PlayGuard users by XP.</p>

      {/* Premium gate */}
      {!isPremium && !loading && (
        <div className="relative">
          {/* Blurred preview — show first 5 as fake locked rows */}
          <div className="space-y-2 blur-sm pointer-events-none select-none mb-0">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 rounded-lg bg-bg-panel border border-white/5"
              >
                <span className={`text-sm font-bold w-6 text-center ${
                  i === 0 ? 'text-yellow-400' :
                  i === 1 ? 'text-white/60' :
                  i === 2 ? 'text-amber-600' :
                  'text-white/30'
                }`}>{i + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-brand-cyan" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-white/10 rounded mb-1.5" />
                  <div className="h-2 w-32 bg-white/5 rounded" />
                </div>
                <div className="h-3 w-14 bg-brand-cyan/20 rounded" />
              </div>
            ))}
          </div>

          {/* Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] rounded-xl">
            <div className="text-3xl mb-2">🔒</div>
            <div className="font-semibold mb-1">Premium Feature</div>
            <div className="text-xs text-white/50 mb-4 text-center max-w-xs">
              See how you rank against other PlayGuard users worldwide.
            </div>
            <button
              onClick={() => void window.api.subscription.checkout()}
              className="text-sm px-5 py-2.5 rounded-lg bg-brand-purple hover:bg-brand-purple/80 font-semibold transition-colors"
            >
              Upgrade — $4.99/mo
            </button>
          </div>
        </div>
      )}

      {/* Actual leaderboard — premium only */}
      {isPremium && (
        <>
          {loading && <div className="text-white/40 text-sm">Loading...</div>}
          {error && <div className="text-red-400 text-sm">{error}</div>}
          {!loading && !error && entries.length === 0 && (
            <div className="text-white/40 text-sm">No data yet. Be the first!</div>
          )}
          {!loading && !error && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map((entry, i) => (
                <div
                  key={entry.username}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg bg-bg-panel border border-white/5"
                >
                  <span className={`text-sm font-bold w-6 text-center ${
                    i === 0 ? 'text-yellow-400' :
                    i === 1 ? 'text-white/60' :
                    i === 2 ? 'text-amber-600' :
                    'text-white/30'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-brand-cyan flex items-center justify-center text-xs font-bold uppercase">
                    {entry.username[0]}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{entry.username}</div>
                    <div className="text-xs text-white/40">Level {entry.current_level} · {entry.achievements_count} achievements</div>
                  </div>
                  <div className="text-sm font-semibold text-brand-cyan">
                    {entry.total_xp} XP
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default LeaderboardPage
