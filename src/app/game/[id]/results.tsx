import { TeamLeaderboard } from '@/components/team-leaderboard'
import { useTeamScores } from '@/hooks/useTeamScores'
import { Participant } from '@/types/types'
import { useEffect } from 'react'
import Confetti from 'react-confetti'
import useWindowSize from 'react-use/lib/useWindowSize'

export default function Results({
  participant,
  gameId,
}: {
  participant: Participant
  gameId: string
}) {
  const { scores, loading, reload } = useTeamScores(gameId, { refreshIntervalMs: 5000 })
  const { width, height } = useWindowSize()

  useEffect(() => {
    reload()
  }, [gameId, reload])

  const playerTeamId = participant.game_team_id ?? null
  const playerTeamName = scores.find((score) => score.team_id === playerTeamId)?.name

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="text-center pt-12 pb-6 px-4">
        <p className="text-sm uppercase tracking-[0.4em] text-white/50">Classificació final</p>
        <h1 className="text-4xl font-bold mt-3">Gràcies per apostar, {participant.nickname}!</h1>
        <p className="mt-3 text-white/70">
          Cada aposta encertada suma 3 punts al teu equip i l&apos;amfitrió pot afegir punts del repte després de cada prova.
        </p>
      </div>
      <div className="flex justify-center px-4 pb-16">
        <div className="w-full max-w-3xl">
          {participant.game_team_id && playerTeamName && (
            <p className="text-center text-white/70 mb-4">
              Formes part de <span className="font-semibold">{playerTeamName}</span>
            </p>
          )}
          {loading ? (
            <p className="text-center text-white/60 py-10">Carregant classificació…</p>
          ) : (
            <TeamLeaderboard
              scores={scores}
              highlightTeamId={participant.game_team_id ?? null}
              highlightLabel="El teu equip"
              title="Classificació final"
              subtitle="Els punts combinen apostes encertades (3 punts) i els punts extra atorgats al final de cada repte."
            />
          )}
        </div>
      </div>
      <Confetti width={width} height={height} recycle={false} />
    </div>
  )
}
