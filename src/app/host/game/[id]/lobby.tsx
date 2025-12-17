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
      <div className="min-h-screen px-6 py-10 text-white flex">
        <section
          className="glow-panel relative overflow-hidden p-8 md:p-12 w-full max-w-none flex flex-col gap-10"
          style={{ background: heroBackground }}
        >
          <div className="space-y-4 text-center lg:text-left">
            <p className="text-xs uppercase tracking-[0.5em] text-white/60">Sala d&apos;espera</p>
            <h1 className="text-4xl md:text-6xl font-black leading-tight">Escaneu per jugar</h1>
          </div>
          <div className="flex flex-col xl:flex-row gap-8 items-stretch flex-1">
            <div
              className="flex flex-col items-center gap-6 w-full xl:w-auto"
              style={{ flexBasis: '30%', maxWidth: '520px' }}
            >
              <div className="rounded-3xl border border-white/20 bg-white/5 p-4 sm:p-6 aspect-square w-full flex items-center justify-center">
                {joinUrl ? (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="bg-white p-4 sm:p-8 rounded-3xl shadow-2xl">
                      <Canvas text={joinUrl} options={{ width: 420, margin: 0, scale: 12 }} />
                    </div>
                    <p className="text-base text-white/75 text-center break-all">{joinUrl}</p>
                  </div>
                ) : (
                  <p className="text-white/60 text-base">Generant enllaç per a unir-se…</p>
                )}
              </div>
              <button
                onClick={onStart}
                className="tactile-button w-full bg-emerald-400 text-black text-xl py-4"
              >
                Organitza els equips
              </button>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/5 p-6 md:p-8 flex flex-col gap-6 flex-1 min-h-[320px]">
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
