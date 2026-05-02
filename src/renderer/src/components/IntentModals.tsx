import { useEffect, useState } from 'react'

interface PreSessionMeta {
  appId: string
  name: string
  source: string
  startedAt: number
}

interface PostSessionMeta extends PreSessionMeta {
  endedAt: number
  durationSeconds: number
}

type Modal =
  | { kind: 'pre'; meta: PreSessionMeta }
  | { kind: 'post'; meta: PostSessionMeta }

const PLAN_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '60 min', value: 60 },
  { label: '90 min', value: 90 },
  { label: 'All in', value: 0 }
]

const FEELING_OPTIONS: Array<{ emoji: string; label: string; value: string }> = [
  { emoji: '😌', label: 'Relaxed', value: 'relaxed' },
  { emoji: '😐', label: 'Neutral', value: 'neutral' },
  { emoji: '😡', label: 'Frustrated', value: 'frustrated' }
]

function IntentModals() {
  const [modal, setModal] = useState<Modal | null>(null)

  useEffect(() => {
    const offPre = window.electron.ipcRenderer.on(
      'intent:ask-before',
      (_e, meta: PreSessionMeta) => {
        setModal({ kind: 'pre', meta })
      }
    )
    const offPost = window.electron.ipcRenderer.on(
      'intent:ask-after',
      (_e, meta: PostSessionMeta) => {
        setModal({ kind: 'post', meta })
      }
    )
    return () => {
      offPre()
      offPost()
    }
  }, [])

  if (!modal) return null

  const close = (): void => setModal(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-bg-panel border border-white/10 rounded-xl p-6 w-[420px] max-w-[90vw] shadow-2xl">
        {modal.kind === 'pre' ? (
          <PreSessionContent meta={modal.meta} onClose={close} />
        ) : (
          <PostSessionContent meta={modal.meta} onClose={close} />
        )}
      </div>
    </div>
  )
}

function PreSessionContent({
  meta,
  onClose
}: {
  meta: PreSessionMeta
  onClose: () => void
}): React.JSX.Element {
  const handleSelect = (minutes: number): void => {
    // For now we just close — backend storage of intent can come later
    console.log(`[intent] pre-session plan: ${minutes} min for ${meta.name}`)
    onClose()
  }

  return (
    <>
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
        {meta.name}
      </div>
      <h2 className="text-xl font-bold mb-2">How long do you plan to play?</h2>
      <p className="text-sm text-white/50 mb-5">
        Setting an intention helps you stay aware of your time.
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {PLAN_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => handleSelect(opt.value)}
            className="bg-white/5 hover:bg-brand-purple/20 border border-white/10 hover:border-brand-purple/50 rounded-lg py-3 text-sm font-medium transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full text-xs text-white/40 hover:text-white/60 py-2"
      >
        Skip
      </button>
    </>
  )
}

function PostSessionContent({
  meta,
  onClose
}: {
  meta: PostSessionMeta
  onClose: () => void
}): React.JSX.Element {
  const minutes = Math.round(meta.durationSeconds / 60)

  const handleSelect = (feeling: string): void => {
    console.log(`[intent] post-session feeling: ${feeling} after ${minutes}min of ${meta.name}`)
    onClose()
  }

  return (
    <>
      <div className="text-xs text-white/40 uppercase tracking-wider mb-2">
        {meta.name} • {minutes} min
      </div>
      <h2 className="text-xl font-bold mb-2">How do you feel?</h2>
      <p className="text-sm text-white/50 mb-5">
        A quick check-in helps us spot patterns over time.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {FEELING_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className="bg-white/5 hover:bg-brand-purple/20 border border-white/10 hover:border-brand-purple/50 rounded-lg py-4 transition-colors flex flex-col items-center gap-1"
          >
            <span className="text-2xl">{opt.emoji}</span>
            <span className="text-xs">{opt.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full text-xs text-white/40 hover:text-white/60 py-2"
      >
        Skip
      </button>
    </>
  )
}

export default IntentModals