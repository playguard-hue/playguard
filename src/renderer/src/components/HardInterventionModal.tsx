import { useEffect, useState } from 'react'
import type { HardInterventionEvent } from '../../../preload/index.d'

function HardInterventionModal() {
  const [event, setEvent] = useState<HardInterventionEvent | null>(null)

  useEffect(() => {
    const unsub = window.api.focusHardIntervention.onTriggered((data) => {
      setEvent(data as HardInterventionEvent)
    })
    return unsub
  }, [])

  if (!event) return null

  const minutes = Math.floor(event.durationMs / 60000)

  const handleContinue = (): void => {
    // User chooses to stay in distractor — close modal but keep session running
    setEvent(null)
  }

  const handleEnd = async (): Promise<void> => {
    await window.api.focus.end('failed')
    setEvent(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="bg-bg-panel border border-brand-purple/40 rounded-2xl p-8 w-[480px] max-w-[90vw] shadow-2xl">
        <div className="text-5xl mb-4 text-center">🎯</div>
        <h2 className="text-2xl font-bold mb-2 text-center">Hey — checking in</h2>
        <p className="text-sm text-white/60 text-center mb-6 leading-relaxed">
          You've been on <span className="font-semibold text-white">{event.distractorApp}</span> for{' '}
          <span className="font-semibold text-white">{minutes} minutes</span>.
          <br />
          You said you wanted to focus on:
        </p>

        <div className="bg-gradient-to-r from-brand-purple/15 to-brand-cyan/10 border border-brand-purple/30 rounded-lg p-4 mb-6">
          <div className="text-xs uppercase tracking-wider text-brand-cyan font-medium mb-1">
            Your focus
          </div>
          <div className="font-semibold">{event.sessionIntent}</div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleContinue}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg py-3 text-sm font-medium transition-colors"
          >
            Keep going
            <div className="text-[10px] text-white/40 mt-0.5">I'll get back</div>
          </button>
          <button
            onClick={() => void handleEnd()}
            className="bg-brand-purple hover:bg-brand-purple/80 rounded-lg py-3 text-sm font-medium transition-colors"
          >
            End session
            <div className="text-[10px] text-white/70 mt-0.5">I'm done</div>
          </button>
        </div>
      </div>
    </div>
  )
}

export default HardInterventionModal