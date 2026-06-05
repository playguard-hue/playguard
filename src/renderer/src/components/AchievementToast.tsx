import { useEffect, useState } from 'react'
import type { AchievementUnlockedEvent } from '../../../preload/index.d'

interface Toast {
  id: number
  data: AchievementUnlockedEvent
}

function AchievementToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const unsub = window.api.achievements.onUnlocked((data) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, data }])
      // Auto-dismiss after 6 sec
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 6000)
    })
    return unsub
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="bg-gradient-to-br from-brand-purple to-brand-cyan rounded-xl p-4 shadow-2xl border border-white/20 w-80 pointer-events-auto animate-slide-in"
          style={{
            animation: 'slideIn 0.4s ease-out'
          }}
        >
          <div className="flex items-start gap-3">
            <div className="text-4xl">{toast.data.def.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-white/70 font-medium mb-0.5">
                🏆 Achievement Unlocked
              </div>
              <div className="font-bold text-white mb-0.5">{toast.data.def.title}</div>
              <div className="text-xs text-white/80">{toast.data.def.description}</div>
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(120%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

export default AchievementToast