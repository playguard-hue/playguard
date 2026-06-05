import { useEffect, useState } from 'react'
import { Home, Timer, Target, Trophy, Swords, BarChart3, Settings as SettingsIcon, Power, Star, type LucideIcon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/Logo.png'
import type { Page } from '../App'
import type { UserStats, SubscriptionInfo } from '../../../preload/index.d'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

interface NavItem {
  id: Page
  label: string
  Icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', Icon: Home },
  { id: 'limits', label: 'Limits', Icon: Timer },
  { id: 'focus', label: 'Focus', Icon: Target },
  { id: 'achievements', label: 'Achievements', Icon: Trophy },
  { id: 'challenges', label: 'Challenges', Icon: Swords },
  { id: 'leaderboard', label: 'Leaderboard', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', Icon: SettingsIcon }
]

function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth()
  const [version, setVersion] = useState('—')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)

  useEffect(() => {
    if (!window.api?.app?.getVersion) {
      console.error('[Sidebar] window.api.app.getVersion not available')
      setVersion('?')
      return
    }
    window.api.app
      .getVersion()
      .then((v) => {
        setVersion(v || '?')
      })
      .catch(() => setVersion('?'))
  }, [])

  // Load stats + listen for unlock events
  useEffect(() => {
    const load = (): void => {
      void window.api.achievements
        .getStats()
        .then(setStats)
        .catch(() => undefined)
    }
    load()
    const unsub = window.api.achievements.onUnlocked(() => load())
    return unsub
  }, [])
 
  // Load subscription
  useEffect(() => {
    void window.api.subscription.get().then((res) => {
      if (res.data) setSubscription(res.data)
    })
  }, [])

  const xpPercent = stats
    ? Math.min(100, Math.round((stats.currentXp / stats.xpForNext) * 100))
    : 0

  return (
    <aside className="w-60 bg-bg-panel border-r border-white/5 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" className="w-10 h-10 object-contain" />
          <div>
            <div className="font-semibold text-sm">PlayGuard</div>
            <div className="text-xs text-white/40">v{version}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = currentPage === item.id
          const { Icon } = item
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-brand-purple/15 text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={16} strokeWidth={2} className="flex-shrink-0" />
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-cyan" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Level badge */}
      {stats && (
        <button
          onClick={() => onNavigate('achievements')}
          className="mx-3 mb-3 p-3 rounded-lg bg-gradient-to-br from-brand-purple/15 to-brand-cyan/10 border border-brand-purple/30 hover:border-brand-purple/50 transition-colors text-left"
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Star size={14} fill="currentColor" className="text-yellow-400" />
              <span className="text-sm font-semibold">Level {stats.level}</span>
            </div>
            <span className="text-[10px] text-white/50 font-medium">
              {stats.totalXp} XP
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-purple to-brand-cyan transition-all"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
          <div className="text-[10px] text-white/40 mt-1.5">
            {stats.currentXp} / {stats.xpForNext} to next level
          </div>
        </button>
      )}

      {/* User section */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-brand-cyan flex items-center justify-center text-xs font-bold uppercase">
            {user?.username?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm truncate">{user?.username ?? 'Guest'}</span>
              {subscription?.status === 'active' && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-gradient-to-r from-brand-purple to-brand-cyan text-white font-bold tracking-wide flex-shrink-0">
                  PREMIUM
                </span>
              )}
            </div>
            <div className="text-xs text-white/40 truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => void logout()}
            title="Sign out"
            className="text-white/40 hover:text-white w-6 h-6 flex items-center justify-center rounded hover:bg-white/5"
          >
            <Power size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar