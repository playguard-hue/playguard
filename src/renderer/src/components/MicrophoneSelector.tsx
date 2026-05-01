import { useEffect, useRef, useState } from 'react'

interface MicrophoneSelectorProps {
  selectedId: string
  onChange: (deviceId: string) => void
}

interface MicDevice {
  deviceId: string
  label: string
}

function MicrophoneSelector({
  selectedId,
  onChange
}: MicrophoneSelectorProps): JSX.Element {
  const [devices, setDevices] = useState<MicDevice[]>([])
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [volume, setVolume] = useState(0)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  // Request mic permission and list devices
  useEffect(() => {
    let cancelled = false

    const init = async (): Promise<void> => {
      try {
        // Asking for permission is required for device labels to be available
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        tempStream.getTracks().forEach((t) => t.stop())

        const all = await navigator.mediaDevices.enumerateDevices()
        if (cancelled) return

        const mics = all
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || 'Unknown microphone'
          }))

        // Always include "Default" as first option
        setDevices([{ deviceId: 'default', label: 'System default' }, ...mics])
      } catch (err) {
        console.error('Mic permission denied or unavailable', err)
        if (!cancelled) setPermissionDenied(true)
      }
    }

    init()

    // React to plug/unplug
    const onChangeDevices = (): void => {
      void init()
    }
    navigator.mediaDevices.addEventListener('devicechange', onChangeDevices)

    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', onChangeDevices)
    }
  }, [])

  // Live volume meter for currently-selected device
  useEffect(() => {
    if (permissionDenied) return

    let cancelled = false

    const start = async (): Promise<void> => {
      // Cleanup any previous stream
      stopMeter()

      try {
        const constraints: MediaStreamConstraints = {
          audio:
            selectedId === 'default'
              ? true
              : { deviceId: { exact: selectedId } }
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream

        const audioCtx = new AudioContext()
        audioCtxRef.current = audioCtx
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)

        const data = new Uint8Array(analyser.frequencyBinCount)

        const tick = (): void => {
          analyser.getByteTimeDomainData(data)
          // Calculate RMS (root mean square) for volume
          let sum = 0
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128
            sum += v * v
          }
          const rms = Math.sqrt(sum / data.length)
          setVolume(Math.min(1, rms * 3)) // amplify a bit for visibility
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch (err) {
        console.error('Could not start volume meter', err)
      }
    }

    void start()

    return () => {
      cancelled = true
      stopMeter()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, permissionDenied])

  const stopMeter = (): void => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    setVolume(0)
  }

  if (permissionDenied) {
    return (
      <div className="text-xs text-red-400 max-w-[240px] text-right">
        Microphone access denied. Please allow it in your system settings.
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2 w-[260px]">
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-elevated border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-purple"
      >
        {devices.length === 0 ? (
          <option>Loading...</option>
        ) : (
          devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))
        )}
      </select>

      {/* Volume meter */}
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-cyan to-brand-purple transition-[width] duration-75"
          style={{ width: `${volume * 100}%` }}
        />
      </div>
    </div>
  )
}

export default MicrophoneSelector