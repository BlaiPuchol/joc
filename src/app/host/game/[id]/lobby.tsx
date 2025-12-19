import { Participant } from '@/types/types'
import { useQRCode } from 'next-qrcode'
import { useEffect, useState } from 'react'

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
  const [qrSize, setQrSize] = useState(280)

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
    const updateQrSize = () => {
      if (typeof window === 'undefined') {
        setQrSize(320)
        return
      }
      const desired = Math.min(window.innerWidth * 0.5, window.innerHeight * 0.45, 360)
      setQrSize(Math.max(140, Math.floor(desired)))
    }

    updateQrSize()
    if (typeof window === 'undefined') return

    window.addEventListener('resize', updateQrSize)
    return () => window.removeEventListener('resize', updateQrSize)
  }, [])

  const accentColor = '#22c55e'
  const screenBackground = `radial-gradient(circle at 18% 20%, rgba(34,197,94,0.35), transparent 45%), #020617`
  const heroBackground = `linear-gradient(135deg, rgba(34,197,94,0.45), rgba(2,6,23,0.92))`
  const totalParticipants = participants.length
  const qrShellSize = Math.min(qrSize + 48, 420)

  return (
    <div className="h-screen" style={{ background: screenBackground }}>
      <div className="h-full px-4 sm:px-6 py-6 sm:py-10 text-white flex">
        <section
          className="glow-panel relative overflow-y-auto p-6 sm:p-8 md:p-12 w-full max-w-none h-full flex flex-col gap-8"
          style={{ background: heroBackground }}
        >
          <div className="space-y-4 text-center lg:text-left">
            <p className="text-xs uppercase tracking-[0.5em] text-white/60">Sala d&apos;espera</p>
            <h1 className="text-4xl md:text-4xl font-black leading-tight">Escaneu per jugar</h1>
          </div>
          <div className="flex flex-col xl:flex-row gap-8 items-stretch flex-1 min-h-0">
            <div
              className="flex flex-col items-center gap-6 w-auto max-w-full min-h-0"
              style={{ flexBasis: '20%', maxWidth: '520px' }}
            >
              <div
                className="rounded-3xl border border-white/20 bg-white/5 p-4 sm:p-6 flex items-center justify-center w-full"
                style={{ width: `min(100%, ${qrShellSize}px)`, aspectRatio: '1 / 1' }}
              >
                {joinUrl ? (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div
                      className="bg-white rounded-3xl shadow-2xl flex items-center justify-center"
                      style={{ width: '100%', maxWidth: qrSize, aspectRatio: '1 / 1', padding: '1.25rem' }}
                    >
                      <Canvas text={joinUrl} options={{ width: Math.max(120, qrSize - 40), margin: 0 }} />
                    </div>
                    <p className="text-base text-white/75 text-center break-all">{joinUrl}</p>
                  </div>
                ) : (
                  <p className="text-white/60 text-base">Generant enllaç per a unir-se…</p>
                )}
              </div>
              <button
                onClick={onStart}
                className="tactile-button w-full bg-emerald-400 text-black text-xl py-4 mt-auto"
              >
                Organitza els equips
              </button>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/5 p-6 md:p-8 flex flex-col gap-6 flex-1 min-h-[320px] overflow-hidden">
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
                  <div className="flex flex-wrap gap-4">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="px-6 py-3 rounded-full border border-white/20 bg-white/10 text-2xl font-semibold tracking-tight shadow-[0_15px_45px_rgba(0,0,0,0.35)]"
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
