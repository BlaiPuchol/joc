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

  return (
    <div className="flex justify-center items-center min-h-screen px-4 bg-slate-900">
      <div className="bg-black/70 border border-white/10 rounded-3xl p-10 w-full max-w-5xl">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <p className="text-sm uppercase tracking-[0.4em] text-white/40">
              Registered Players
            </p>
            <div className="flex flex-wrap mt-4">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="text-lg font-semibold bg-green-500/20 border border-green-400/40 rounded-full px-4 py-2 m-2"
                >
                  {participant.nickname}
                </div>
              ))}
              {participants.length === 0 && (
                <p className="text-white/60">Waiting for players to join...</p>
              )}
            </div>
          </div>
          <div className="w-full md:w-72 flex flex-col justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Live Betting Game</h2>
              <p className="text-white/70 text-sm">
                Share the QR code or link so the audience can open the betting app on
                their phones.
              </p>
              <div className="mt-4">
                {joinUrl ? (
                  <>
                    <Canvas
                      text={joinUrl}
                      options={{ width: 220, margin: 1, scale: 4 }}
                    />
                    <p className="mt-2 text-xs text-white/60 break-all">{joinUrl}</p>
                  </>
                ) : (
                  <p className="text-white/50 text-sm">Generating join link…</p>
                )}
              </div>
            </div>
            <button
              onClick={onStart}
              className="mt-6 bg-green-500 text-black font-bold py-3 px-6 rounded-2xl hover:bg-green-400 transition"
            >
              Organize teams
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
