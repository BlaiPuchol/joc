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

  const accentColor = '#22c55e'
  const screenBackground = `radial-gradient(circle at 18% 20%, rgba(34,197,94,0.35), transparent 45%), #020617`
  const heroBackground = `linear-gradient(135deg, rgba(34,197,94,0.45), rgba(2,6,23,0.92))`
  const totalParticipants = participants.length

  return (
    <div className="min-h-screen" style={{ background: screenBackground }}>
      <div className="min-h-screen px-6 py-10 text-white">
        <section
          className="glow-panel relative overflow-hidden p-8 md:p-12 w-full max-w-none"
          style={{ background: heroBackground }}
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)] xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-stretch min-h-[65vh]">
            <div className="space-y-8 flex flex-col">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">Sala d&apos;espera</p>
                <h1 className="text-4xl md:text-6xl font-black leading-tight">Escaneu per jugar</h1>
              </div>
              <div className="rounded-3xl border border-white/20 bg-white/5 p-6 md:p-8 grow flex items-center justify-center">
                {joinUrl ? (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="w-full flex justify-center">
                      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-2xl">
                        <Canvas text={joinUrl} options={{ width: 420, margin: 0, scale: 12 }} />
                      </div>
                    </div>
                    <p className="text-base text-white/75 text-center break-all">{joinUrl}</p>
                  </div>
                ) : (
                  <p className="text-white/60 text-base">Generant enllaç per a unir-se…</p>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={onStart}
                  className="tactile-button bg-emerald-400 text-black text-xl py-4 px-8"
                >
                  Organitza els equips
                </button>
              </div>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/5 p-6 md:p-8 flex flex-col gap-6 h-full">
              <header className="space-y-2">
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">Participants</p>
                <h2 className="text-4xl font-semibold tracking-tight">
                  {totalParticipants} {totalParticipants === 1 ? 'persona' : 'persones'}
                </h2>
              </header>
              <div className="grow overflow-y-auto pr-2">
                {participants.length === 0 ? (
                  <p className="text-white/70 text-lg">Encara no s&apos;ha unit ningú.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className="rounded-3xl border border-white/20 bg-white/10 px-5 py-4 text-2xl font-semibold tracking-tight shadow-[0_15px_45px_rgba(0,0,0,0.35)]"
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
