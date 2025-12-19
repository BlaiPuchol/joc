import { Participant } from '@/types/types'
import { useQRCode } from 'next-qrcode'
import { useEffect, useMemo, useState } from 'react'

export default function Lobby({
  participants,
  onStart,
  gameId,
}: {
  participants: Participant[]
  onStart: () => void
  gameId: string
}) {
  const { Canvas } = useQRCode()
  const [joinUrl, setJoinUrl] = useState('')
  const [qrSize, setQrSize] = useState(240)
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const baseEnv = process.env.NEXT_PUBLIC_SITE_URL
    const base =
      baseEnv && baseEnv.length > 0
        ? baseEnv.replace(/\/$/, '')
        : typeof window !== 'undefined'
        ? window.location.origin
        : ''
    setJoinUrl(`${base}/game/${gameId}`)
  }, [gameId])

  useEffect(() => {
    const updateResponsiveState = () => {
      if (typeof window === 'undefined') {
        setQrSize(240)
        setIsNarrow(false)
        return
      }
      const width = window.innerWidth
      const height = window.innerHeight
      const desired = Math.min(width * 0.28, height * 0.5, 320)
      setQrSize(Math.max(140, Math.floor(desired)))
      setIsNarrow(width < 1280)
    }

    updateResponsiveState()
    if (typeof window === 'undefined') return

    window.addEventListener('resize', updateResponsiveState)
    return () => window.removeEventListener('resize', updateResponsiveState)
  }, [])

  const accentColor = '#22c55e'
  const screenBackground = `radial-gradient(circle at 18% 20%, rgba(34,197,94,0.35), transparent 45%), #020617`
  const heroBackground = `linear-gradient(135deg, rgba(34,197,94,0.45), rgba(2,6,23,0.92))`
  const totalParticipants = participants.length
  const qrShellSize = Math.min(qrSize + 48, isNarrow ? 360 : 420)
  const layoutClass = useMemo(() => (isNarrow ? 'grid grid-cols-1 gap-8' : 'grid grid-cols-[auto,1fr] gap-8'), [isNarrow])

  return (
    <div className="h-screen" style={{ background: screenBackground }}>
      <div className="h-full px-4 sm:px-6 py-6 sm:py-10 text-white flex">
        <section
          className="glow-panel relative overflow-hidden p-6 sm:p-8 md:p-12 w-full max-w-none h-full flex flex-col gap-8"
          style={{ background: heroBackground }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-4 text-center lg:text-left">
              <p className="text-xs uppercase tracking-[0.5em] text-white/60">Sala d&apos;espera</p>
              <h1 className="text-4xl md:text-5xl font-black leading-tight">Escaneu per jugar</h1>
              <p className="text-white/70 text-sm md:text-base max-w-xl">
                El QR porta els jugadors directament al lobby. Projecta esta pantalla i organitza els equips quan estiguen tots.
              </p>
            </div>
            <button
              onClick={onStart}
              className="self-start lg:self-auto tactile-button bg-emerald-400 text-black text-lg font-semibold px-6 py-3 rounded-2xl shadow-lg"
            >
              Organitza els equips
            </button>
          </div>
          <div className={`${layoutClass} items-stretch flex-1 min-h-0`}
            style={{ gridTemplateRows: isNarrow ? 'auto auto' : 'minmax(0,1fr)' }}
          >
            <div className="flex flex-col gap-5 items-center justify-between max-w-full">
              <div
                className="rounded-3xl border border-white/20 bg-white/5 p-4 sm:p-6 flex items-center justify-center w-full"
                style={{ width: `min(100%, ${qrShellSize}px)`, aspectRatio: '1 / 1' }}
              >
                {joinUrl ? (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div
                      className="bg-white rounded-3xl shadow-2xl flex items-center justify-center"
                      style={{ width: '100%', maxWidth: qrSize, aspectRatio: '1 / 1', padding: '1.1rem' }}
                    >
                      <Canvas text={joinUrl} options={{ width: Math.max(120, qrSize - 40), margin: 0 }} />
                    </div>
                    <p className="text-base text-white/75 text-center break-all">{joinUrl}</p>
                  </div>
                ) : (
                  <p className="text-white/60 text-base">Generant enllaç per a unir-se…</p>
                )}
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/5 p-6 md:p-8 flex flex-col gap-6 min-h-0 overflow-hidden">
              <header className="space-y-2">
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">Participants</p>
                <h2 className="text-4xl font-semibold tracking-tight">
                  {totalParticipants} {totalParticipants === 1 ? 'persona' : 'persones'}
                </h2>
              </header>
              <div className="grow overflow-y-auto pr-2 min-h-0">
                {participants.length === 0 ? (
                  <p className="text-white/70 text-lg">Encara no s&apos;ha unit ningú.</p>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="px-5 py-2 rounded-full border border-white/20 bg-white/10 text-xl font-semibold tracking-tight shadow-[0_15px_45px_rgba(0,0,0,0.35)]"
                      >
                        {participant.nickname}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
            background: 'radial-gradient(circle at top right, rgba(255,255,255,0.55), transparent 55%)',
          }}></div>
        </section>
      </div>
    </div>
  )
}
