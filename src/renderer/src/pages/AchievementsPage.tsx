import { useEffect, useState } from 'react'
import type { Achievement, AchievementCategory, SubscriptionInfo } from '../../../preload/index.d'

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  streak: '🔥 Streak',
  control: '🛡️ Self-Control',
  mindful: '🧘 Mindfulness',
  focus: '🎯 Focus'
}

const CATEGORY_ORDER: AchievementCategory[] = ['streak', 'control', 'mindful', 'focus']

function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void load()
    const unsub = window.api.achievements.onUnlocked(() => {
      void load()
    })
    return unsub
  }, [])

  const load = async (): Promise<void> => {
    setLoading(true)
    try {
      await window.api.achievements.refresh()
      const [list, subRes] = await Promise.all([
        window.api.achievements.getAll(),
        window.api.subscription.get()
      ])
      setAchievements(list)
      if (subRes.data) setSubscription(subRes.data)
    } catch (err) {
      console.error('Failed to load achievements', err)
    } finally {
      setLoading(false)
    }
  }

  const isPremium = subscription?.status === 'active'

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalCount = achievements.length
  const progress = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0

  const premiumCount = achievements.filter((a) => !a.free).length

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

      {/* Premium upsell banner — only for free users */}
      {!isPremium && (
        <div className="bg-gradient-to-br from-yellow-500/10 to-brand-purple/10 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold mb-0.5">
              🔒 {premiumCount} Premium achievements locked
            </div>
            <div className="text-xs text-white/50">
              Upgrade to unlock all achievements and earn bonus XP.
            </div>
          </div>
          <button
            onClick={() => void window.api.subscription.checkout()}
            className="flex-shrink-0 text-xs px-4 py-2 rounded-lg bg-brand-purple hover:bg-brand-purple/80 font-semibold transition-colors"
          >
            Upgrade — $4.99/mo
          </button>
        </div>
      )}

      {/* Categories */}
      {grouped.map((group) => (
        <section key={group.category} className="mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/60 mb-3">
            {group.label}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {group.items.map((a) => (
              <AchievementCard key={a.key} achievement={a} isPremium={isPremium} />
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

function AchievementCard({
  achievement,
  isPremium
}: {
  achievement: Achievement
  isPremium: boolean
}) {
  const { unlocked, emoji, title, description, rarity, free, unlockedAt } = achievement
  const isLocked = !free && !isPremium

  const date = unlockedAt
    ? new Date(unlockedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
    : null
  const xp = RARITY_XP_VALUES[rarity] ?? 0
  const rarityMeta = RARITY_STYLES[rarity] ?? RARITY_STYLES.common

  if (isLocked) {
    return (
      <div className="relative rounded-xl p-4 border bg-bg-panel border-white/5 opacity-70">
        {/* Lock overlay */}
        <div className="absolute inset-0 rounded-xl flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] z-10">
          <div className="text-2xl mb-1">🔒</div>
          <div className="text-[10px] text-white/50 font-medium">Premium only</div>
        </div>
        {/* Blurred content behind */}
        <div className="blur-sm pointer-events-none select-none">
          <div className="text-4xl mb-2 grayscale opacity-40">{emoji}</div>
          <div className="font-semibold text-sm mb-0.5">{title}</div>
          <div className="text-xs text-white/50 leading-snug mb-2">{description}</div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
            <span className={`text-[10px] uppercase tracking-wider font-medium ${rarityMeta.color}`}>
              {rarityMeta.label}
            </span>
            <span className="text-xs font-bold text-brand-cyan">+{xp} XP</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative rounded-xl p-4 border transition-all ${
        unlocked
          ? 'bg-gradient-to-br from-brand-purple/10 to-brand-cyan/5 border-brand-purple/30'
          : 'bg-bg-panel border-white/5 opacity-60'
      }`}
    >
      {!free && isPremium && (
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
