import { Participant } from '@/types/types'
import { useQRCode } from 'next-qrcode'
import { useEffect, useRef, useState } from 'react'

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
  const [qrSize, setQrSize] = useState(200)
  const qrWrapperRef = useRef<HTMLDivElement>(null)

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
    if (!qrWrapperRef.current) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        const { width } = entry.contentRect
        setQrSize(width)
      }
    })

    observer.observe(qrWrapperRef.current)
    return () => observer.disconnect()
  }, [])

  const accentColor = '#22c55e'
  const screenBackground = `radial-gradient(circle at 18% 20%, rgba(34,197,94,0.35), transparent 45%), #020617`
  const heroBackground = `linear-gradient(135deg, rgba(34,197,94,0.45), rgba(2,6,23,0.92))`
  const totalParticipants = participants.length

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: screenBackground }}>
      <div className="h-full w-full px-4 sm:px-6 py-6 sm:py-10 text-white flex flex-col">
        <section
          className="glow-panel relative overflow-hidden p-6 sm:p-8 md:p-12 w-full h-full flex flex-col gap-6"
          style={{ background: heroBackground }}
        >
          <div className="flex flex-row items-center justify-between gap-4 shrink-0">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.5em] text-white/60">Sala d&apos;espera</p>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight">Escaneu per jugar</h1>
            </div>
            <button
              onClick={onStart}
              className="tactile-button bg-emerald-400 text-black text-base md:text-lg font-semibold px-6 py-3 rounded-2xl shadow-lg whitespace-nowrap"
            >
              Organitza els equips
            </button>
          </div>

          <div className="flex flex-row gap-6 flex-1 min-h-0 w-full items-stretch">
            <div className="h-full aspect-square max-w-[45%] flex-shrink-0 min-w-0 relative">
               <div className="w-full h-full rounded-3xl border border-white/20 bg-white/5 p-4 flex flex-col items-center justify-center gap-4">
                  <div 
                    ref={qrWrapperRef}
                    className="bg-white rounded-2xl shadow-2xl aspect-square w-auto h-auto max-w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden"
                    style={{ width: 'auto', height: 'auto' }} 
                  >
                     {joinUrl ? (
                        <Canvas text={joinUrl} options={{ width: qrSize, margin: 0 }} />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center text-black/50">...</div>
                     )}
                  </div>
                  <p className="text-sm md:text-base text-white/75 text-center break-all line-clamp-2 px-2 shrink-0">
                    {joinUrl || 'Generant...'}
                  </p>
               </div>
            </div>

            <div className="flex-1 rounded-3xl border border-white/15 bg-white/5 p-6 md:p-8 flex flex-col gap-4 min-w-0 overflow-hidden h-full">
              <header className="space-y-1 shrink-0">
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">Participants</p>
                <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold tracking-tight">
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
                        className="px-4 py-2 rounded-full border border-white/20 bg-white/10 text-base md:text-lg font-semibold tracking-tight shadow-lg"
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
