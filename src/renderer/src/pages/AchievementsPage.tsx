import { useEffect, useState } from 'react'
import type { Achievement, AchievementCategory } from '../../../preload/index.d'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  streak: '🔥 Streak',
  control: '🛡️ Self-Control',
  mindful: '🧘 Mindfulness',
  focus: '🎯 Focus'
}

const CATEGORY_ORDER: AchievementCategory[] = ['streak', 'control', 'mindful', 'focus']

function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void load()
    // Refresh whenever unlock fires
    const unsub = window.api.achievements.onUnlocked(() => {
      void load()
    })
    return unsub
  }, [])

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      // Trigger check first
      await window.api.achievements.refresh()
      const list = await window.api.achievements.getAll()
      setAchievements(list)
    } catch (err) {
      console.error('Failed to load achievements', err)
    } finally {
      setLoading(false)
    }
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalCount = achievements.length
  const progress = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    items: achievements.filter((a) => a.category === cat)
  })).filter((g) => g.items.length > 0)

  if (loading) {
    return <div className="p-8 text-white/40">Loading achievements…</div>
  }

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Achievements</h1>
        <p className="text-white/50">Earn badges for healthy gaming habits.</p>
      </header>

      {/* Progress banner */}
      <div className="bg-bg-panel border border-white/5 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-white/40 font-medium mb-1">
              Overall progress
            </div>
            <div className="text-2xl font-bold">
              {unlockedCount} <span className="text-white/40 text-base font-normal">/ {totalCount}</span>
            </div>
          </div>
          <div className="text-3xl font-bold text-brand-cyan">{progress}%</div>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-purple to-brand-cyan transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Categories */}
      {grouped.map((group) => (
        <section key={group.category} className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60 mb-3">
            {group.label}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((a) => (
              <AchievementCard key={a.key} achievement={a} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const RARITY_XP_VALUES: Record<string, number> = {
  common: 50,
  rare: 150,
  epic: 500,
  legendary: 1500
}

const RARITY_STYLES: Record<string, { label: string; color: string }> = {
  common: { label: 'Common', color: 'text-white/40' },
  rare: { label: 'Rare', color: 'text-brand-cyan' },
  epic: { label: 'Epic', color: 'text-purple-400' },
  legendary: { label: 'Legendary', color: 'text-yellow-300' }
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { unlocked, emoji, title, description, rarity, free, unlockedAt } = achievement
  const date = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : null
  const xp = RARITY_XP_VALUES[rarity] ?? 0
  const rarityMeta = RARITY_STYLES[rarity] ?? RARITY_STYLES.common

  return (
    <div
      className={`relative rounded-xl p-4 border transition-all ${
        unlocked
          ? 'bg-gradient-to-br from-brand-purple/10 to-brand-cyan/5 border-brand-purple/30'
          : 'bg-bg-panel border-white/5 opacity-60'
      }`}
    >
      {!free && (
        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider font-medium bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30">
          Premium
        </div>
      )}
      <div className={`text-4xl mb-2 ${unlocked ? '' : 'grayscale opacity-40'}`}>
        {emoji}
      </div>
      <div className="font-semibold text-sm mb-0.5">{title}</div>
      <div className="text-xs text-white/50 leading-snug mb-2">{description}</div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
        <span className={`text-[10px] uppercase tracking-wider font-medium ${rarityMeta.color}`}>
          {rarityMeta.label}
        </span>
        <span className="text-xs font-bold text-brand-cyan">+{xp} XP</span>
      </div>

      {unlocked && date && (
        <div className="text-[10px] text-brand-cyan mt-2 font-medium">Unlocked {date}</div>
      )}
    </div>
  )
}

export default AchievementsPage