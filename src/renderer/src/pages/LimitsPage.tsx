import { useEffect, useState } from 'react'
import type { AppSettings, Stats } from '../../../preload/index.d'

function LimitsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [editing, setEditing] = useState<keyof AppSettings['limits'] | null>(null)
  const [draftValue, setDraftValue] = useState('')

  useEffect(() => {
    void window.api.settings.getAll().then(setSettings)
    void window.api.stats.get().then(setStats).catch(() => undefined)
    const unsub = window.api.stats.onInvalidated(() => {
      void window.api.stats.get().then(setStats).catch(() => undefined)
    })
    return unsub
  }, [])

  const update = async (
    key: keyof AppSettings['limits'],
    value: number
  ): Promise<void> => {
    const updated = await window.api.settings.set('limits', key, value)
    setSettings(updated)
  }

  const startEdit = (key: keyof AppSettings['limits'], current: number): void => {
    setEditing(key)
    setDraftValue(current.toString())
  }

  const commitEdit = async (): Promise<void> => {
    if (!editing) return
    const parsed = parseInt(draftValue, 10)
    if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) {
      await update(editing, parsed)
    }
    setEditing(null)
  }

  if (!settings) {
    return <div className="p-8 text-white/40">Loading...</div>
  }

  // Today's progress
  const todayMinutes = Math.floor((stats?.today_seconds ?? 0) / 60)
  const dailyLimit = settings.limits.dailyMinutes
  const dailyProgress = Math.min(1, todayMinutes / dailyLimit)
  const dailyOver = todayMinutes > dailyLimit

  return (
    <div className="p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-1">Limits</h1>
        <p className="text-white/50">Set healthy gaming boundaries for yourself</p>
      </header>

      {/* Today progress card — visual feedback */}
      <div className="bg-bg-panel border border-white/5 rounded-xl p-6 mb-6 max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium">Today's progress</div>
          <div className={`text-sm ${dailyOver ? 'text-red-400' : 'text-white/60'}`}>
            {formatMinutes(todayMinutes)} / {formatMinutes(dailyLimit)}
          </div>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              dailyOver
                ? 'bg-red-500'
                : dailyProgress > 0.8
                  ? 'bg-yellow-500'
                  : 'bg-gradient-to-r from-brand-cyan to-brand-purple'
            }`}
            style={{ width: `${Math.min(100, dailyProgress * 100)}%` }}
          />
        </div>
        {dailyOver && (
          <div className="text-xs text-red-400 mt-2">
            You've exceeded your daily limit by {formatMinutes(todayMinutes - dailyLimit)}
          </div>
        )}
      </div>

      {/* Limit settings */}
      <div className="space-y-4 max-w-2xl">
        <LimitCard
          title="Daily playtime"
          description="Maximum gaming time per day"
          minutes={settings.limits.dailyMinutes}
          editing={editing === 'dailyMinutes'}
          draftValue={editing === 'dailyMinutes' ? draftValue : ''}
          onStartEdit={() => startEdit('dailyMinutes', settings.limits.dailyMinutes)}
          onChangeDraft={setDraftValue}
          onCommit={commitEdit}
          onCancel={() => setEditing(null)}
        />
        <LimitCard
          title="Session length"
          description="Get a reminder after a continuous session"
          minutes={settings.limits.sessionMinutes}
          editing={editing === 'sessionMinutes'}
          draftValue={editing === 'sessionMinutes' ? draftValue : ''}
          onStartEdit={() => startEdit('sessionMinutes', settings.limits.sessionMinutes)}
          onChangeDraft={setDraftValue}
          onCommit={commitEdit}
          onCancel={() => setEditing(null)}
        />
        <LimitCard
          title="Break reminder"
          description="Stand up and stretch every"
          minutes={settings.limits.breakIntervalMinutes}
          editing={editing === 'breakIntervalMinutes'}
          draftValue={editing === 'breakIntervalMinutes' ? draftValue : ''}
          onStartEdit={() =>
            startEdit('breakIntervalMinutes', settings.limits.breakIntervalMinutes)
          }
          onChangeDraft={setDraftValue}
          onCommit={commitEdit}
          onCancel={() => setEditing(null)}
        />
      </div>
    </div>
  )
}

interface LimitCardProps {
  title: string
  description: string
  minutes: number
  editing: boolean
  draftValue: string
  onStartEdit: () => void
  onChangeDraft: (v: string) => void
  onCommit: () => void
  onCancel: () => void
}

function LimitCard({
  title,
  description,
  minutes,
  editing,
  draftValue,
  onStartEdit,
  onChangeDraft,
  onCommit,
  onCancel
}: LimitCardProps): JSX.Element {
  return (
    <div className="bg-bg-panel border border-white/5 rounded-xl p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium mb-0.5">{title}</div>
        <div className="text-sm text-white/50">{description}</div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {editing ? (
          <>
            <input
              type="number"
              min={1}
              max={1440}
              value={draftValue}
              onChange={(e) => onChangeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onCommit()
                if (e.key === 'Escape') onCancel()
              }}
              autoFocus
              className="w-20 bg-bg-elevated border border-brand-purple rounded px-2 py-1 text-sm text-right focus:outline-none"
            />
            <span className="text-sm text-white/40">min</span>
            <button
              onClick={onCommit}
              className="text-xs bg-brand-purple px-2 py-1 rounded hover:opacity-90"
            >
              Save
            </button>
          </>
        ) : (
          <>
            <div className="font-semibold text-brand-cyan text-right">
              {formatMinutes(minutes)}
            </div>
            <button
              onClick={onStartEdit}
              className="text-xs text-white/40 hover:text-white px-2 py-1 rounded hover:bg-white/5"
            >
              Edit
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function formatMinutes(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export default LimitsPage