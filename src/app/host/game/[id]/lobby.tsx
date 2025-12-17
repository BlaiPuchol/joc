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
      <div className="screen-frame py-10 text-white">
        <section
          className="glow-panel relative overflow-hidden p-8 md:p-12"
          style={{ background: heroBackground }}
        >
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)] items-start">
            <div className="space-y-6 flex flex-col">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">Sala d&apos;espera</p>
                <h1 className="text-4xl md:text-6xl font-black leading-tight">
                  Compartix el QR gegant
                </h1>
                <p className="text-lg md:text-2xl text-white/85 max-w-3xl">
                  Projecta esta pantalla perquè el públic escanege i entre al joc. Quan
                  tingues prou gent, passa a organitzar els equips.
                </p>
              </div>
              <div className="rounded-3xl border border-white/20 bg-white/5 p-6 md:p-8 w-full max-w-xl">
                {joinUrl ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-5 rounded-3xl shadow-2xl">
                      <Canvas text={joinUrl} options={{ width: 340, margin: 0, scale: 10 }} />
                    </div>
                    <p className="text-sm text-white/70 text-center break-all">{joinUrl}</p>
                  </div>
                ) : (
                  <p className="text-white/60 text-base">Generant enllaç per a unir-se…</p>
                )}
              </div>
              <button
                onClick={onStart}
                className="tactile-button max-w-sm bg-emerald-400 text-black text-xl py-4"
              >
                Organitza els equips
              </button>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/5 p-6 md:p-8 flex flex-col gap-6 h-full max-h-[640px]">
              <header className="space-y-2">
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">Participants registrats</p>
                <h2 className="text-3xl font-semibold">
                  {totalParticipants} {totalParticipants === 1 ? 'persona' : 'persones'} a punt
                </h2>
                <p className="text-white/70 text-base">
                  Els sobrenoms apareixeran ací a mesura que la gent es registre.
                </p>
              </header>
              <div className="grow overflow-y-auto pr-2">
                {participants.length === 0 ? (
                  <p className="text-white/70 text-lg">Encara no s&apos;ha unit ningú. Dona temps al públic.</p>
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
