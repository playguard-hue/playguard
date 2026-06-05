import { useEffect, useState } from 'react'

interface LeaderboardEntry {
  username: string
  total_xp: number
  current_level: number
  achievements_count: number
}

function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.leaderboard.get().then((res: any) => {
      if (res.error) setError(res.error)
      else setEntries(res.data ?? [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Leaderboard</h1>
      <p className="text-white/40 text-sm mb-8">Top PlayGuard users by XP.</p>

      {loading && (
        <div className="text-white/40 text-sm">Loading...</div>
      )}

      {error && (
        <div className="text-red-400 text-sm">{error}</div>
      )}

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
    </div>
  )
}

export default LeaderboardPage