import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/Logo.png'
import type { Page } from '../App'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

interface NavItem {
  id: Page
  label: string
  icon: string
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'limits', label: 'Limits', icon: '⏱' },
  { id: 'settings', label: 'Settings', icon: '⚙' }
]

function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth()
  const [version, setVersion] = useState('—')

  useEffect(() => {
    if (!window.api?.app?.getVersion) {
      console.error('[Sidebar] window.api.app.getVersion not available')
      setVersion('?')
      return
    }
    window.api.app
      .getVersion()
      .then((v) => {
        console.log('[Sidebar] Got version:', v)
        setVersion(v || '?')
      })
      .catch((err) => {
        console.error('[Sidebar] getVersion failed:', err)
        setVersion('?')
      })
  }, [])

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
              <span className="text-base w-5">{item.icon}</span>
              <span>{item.label}</span>
              {active && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-cyan" />
              )}
            </button>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-brand-cyan flex items-center justify-center text-xs font-bold uppercase">
            {user?.username?.[0] ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{user?.username ?? 'Guest'}</div>
            <div className="text-xs text-white/40 truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => void logout()}
            title="Sign out"
            className="text-white/40 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-white/5"
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar