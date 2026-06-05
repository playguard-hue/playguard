import { useEffect, useState } from 'react'
import type { Challenge, ChallengeHistoryItem } from '../../../preload/index.d'

function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [history, setHistory] = useState<ChallengeHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    const [chRes, hRes] = await Promise.all([
      window.api.challenges.getAll(),
      window.api.challenges.getHistory()
    ])
    if (chRes.error) setError(chRes.error)
    else setChallenges(chRes.data ?? [])
    if (!hRes.error) setHistory(hRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const handleJoin = async (id: string): Promise<void> => {
    setJoining(id)
    const res = await window.api.challenges.join(id)
    setJoining(null)
    if (res.error) {
      setError(res.error)
      return
    }
    void load()
  }

  const formatExpiresIn = (expiresAt: string): string => {
    const ms = new Date(expiresAt).getTime() - Date.now()
    if (ms <= 0) return 'expired'
    const days = Math.floor(ms / (24 * 60 * 60 * 1000))
    if (days >= 1) return `${days}d left`
    const hours = Math.floor(ms / (60 * 60 * 1000))
    return `${hours}h left`
  }

  const active = challenges.filter((c) => c.user_challenge_id && !c.completed)
  const available = challenges.filter((c) => !c.user_challenge_id)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Challenges</h1>
      <p className="text-white/40 text-sm mb-8">Time-limited goals. Earn XP by completing them.</p>

      {loading && <div className="text-white/40 text-sm">Loading...</div>}
      {error && <div className="text-red-400 text-sm mb-4">{error}</div>}

      {!loading && active.length > 0 && (
        <section className="mb-10">
          <div className="text-xs uppercase tracking-wider text-brand-cyan font-medium mb-3">Active</div>
          <div className="space-y-3">
            {active.map((c) => {
              const progress = c.current_progress ?? 0
              const percent = Math.min(100, Math.round((progress / c.goal_value) * 100))
              return (
                <div key={c.id} className="bg-bg-panel border border-brand-purple/30 rounded-xl p-5">
                  <div className="flex items-start gap-4 mb-3">
                    <div className="text-3xl">{c.emoji}</div>
                    <div className="flex-1">
                      <div className="font-semibold mb-0.5">{c.title}</div>
                      <div className="text-xs text-white/50">{c.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-brand-cyan">+{c.xp_reward} XP</div>
                      <div className="text-[10px] text-white/40 mt-0.5">
                        {c.expires_at && formatExpiresIn(c.expires_at)}
                      </div>
                    </div>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-gradient-to-r from-brand-purple to-brand-cyan transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-white/40">
                    {progress} / {c.goal_value}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {!loading && available.length > 0 && (
        <section className="mb-10">
          <div className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">Available</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {available.map((c) => (
              <div key={c.id} className="bg-bg-panel border border-white/5 rounded-xl p-5">
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-3xl">{c.emoji}</div>
                  <div className="flex-1">
                    <div className="font-semibold mb-0.5">{c.title}</div>
                    <div className="text-xs text-white/50">{c.description}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/40">
                    {c.duration_days}d · +{c.xp_reward} XP
                  </div>
                  <button
                    onClick={() => void handleJoin(c.id)}
                    disabled={joining === c.id}
                    className="text-xs px-3 py-1.5 rounded-md bg-brand-purple hover:bg-brand-purple/80 font-medium transition-colors disabled:opacity-50"
                  >
                    {joining === c.id ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && history.length > 0 && (
        <section>
          <div className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">Completed</div>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-bg-panel border border-white/5">
                <div className="text-xl">{h.emoji}</div>
                <div className="flex-1">
                  <div className="text-sm font-medium">{h.title}</div>
                  <div className="text-[11px] text-white/40">
                    {new Date(h.completed_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm font-semibold text-brand-cyan">+{h.xp_reward} XP</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && active.length === 0 && available.length === 0 && history.length === 0 && (
        <div className="text-white/40 text-sm">No challenges available.</div>
      )}
    </div>
  )
}

export default ChallengesPage