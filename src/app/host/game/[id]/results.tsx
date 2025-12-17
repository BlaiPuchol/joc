import { TeamLeaderboard } from '@/components/team-leaderboard'
import { useTeamScores } from '@/hooks/useTeamScores'
import { useEffect } from 'react'
import Confetti from 'react-confetti'
import useWindowSize from 'react-use/lib/useWindowSize'

export default function Results({ gameId }: { gameId: string }) {
  const { scores, loading, reload } = useTeamScores(gameId, { refreshIntervalMs: 5000 })
  const { width, height } = useWindowSize()

  useEffect(() => {
    reload()
  }, [gameId, reload])

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="text-center pt-12 pb-6 px-4">
        <p className="text-sm uppercase tracking-[0.4em] text-white/50">Classificació final</p>
        <h1 className="text-4xl font-bold mt-3">Taula de lideratge</h1>
        <p className="mt-3 text-white/70">
          Cada aposta encertada suma 3 punts al total del seu equip i pots afegir punts extres segons el resultat del repte.
        </p>
      </div>
      <div className="flex justify-center px-4 pb-16">
        <div className="w-full max-w-3xl">
          {loading ? (
            <p className="text-center text-white/70 py-10">Actualitzant classificació…</p>
          ) : (
            <TeamLeaderboard
              scores={scores}
              title="Classificació final"
              subtitle="Els punts combinen apostes encertades (3 punts cadascuna) i els punts del repte que has assignat."
            />
          )}
        </div>
      </div>
      <Confetti width={width} height={height} recycle={false} />
    </div>
  )
}
