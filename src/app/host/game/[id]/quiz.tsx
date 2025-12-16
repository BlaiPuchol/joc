import {
  GameChallenge,
  GameRound,
  GameTeam,
  Participant,
  RoundLineup,
  RoundVote,
} from '@/types/types'
import { useEffect, useMemo, useState } from 'react'

type Phase = 'leader_selection' | 'voting' | 'action' | 'resolution'

type LineupEntry = RoundLineup & { participant: Participant }

type Props = {
  phase: Phase | 'lobby'
  round: GameRound | null
  challenge: GameChallenge | null
  participants: Participant[]
  teams: GameTeam[]
  votes: RoundVote[]
  lineups: LineupEntry[]
  onOpenVoting: (notes: string) => void
  onLockVoting: () => void
  onMarkLosingTeam: (teamId: string) => void
  onNextRound: () => void
  onEndGame: () => void
  onToggleLineup: (teamId: string, participantId: string, shouldAdd: boolean) => void
}

export default function RoundController({
  phase,
  round,
  challenge,
  participants,
  teams,
  votes,
  lineups,
  onOpenVoting,
  onLockVoting,
  onMarkLosingTeam,
  onNextRound,
  onEndGame,
  onToggleLineup,
}: Props) {
  const [headline, setHeadline] = useState('')
  const phaseLabels: Record<Phase | 'lobby', string> = {
    leader_selection: 'Selecció de líders',
    voting: 'Apostes obertes',
    action: 'Repte en marxa',
    resolution: 'Resolució',
    lobby: 'Sala d\'espera',
  }

  useEffect(() => {
    setHeadline(round?.leader_notes ?? '')
  }, [round?.leader_notes])
  const totalPlayers = participants.length
  const pendingVotes = Math.max(totalPlayers - votes.length, 0)
  const losingTeamId = round?.losing_team_id ?? null

  const lineupByTeam = useMemo(() => {
    return teams.reduce<Record<string, Participant[]>>((acc, team) => {
      acc[team.id] = lineups
        .filter((entry) => entry.team_id === team.id)
        .map((entry) => entry.participant)
      return acc
    }, {})
  }, [lineups, teams])

  const membersByTeam = useMemo(() => {
    return teams.reduce<Record<string, Participant[]>>((acc, team) => {
      acc[team.id] = participants.filter((participant) => participant.game_team_id === team.id)
      return acc
    }, {})
  }, [participants, teams])

  const requiredCount = challenge?.participants_per_team ?? null

  const isTeamReady = (team: GameTeam) => {
    const selection = lineupByTeam[team.id] ?? []
    if (!requiredCount) {
      return selection.length > 0
    }
    return selection.length === requiredCount
  }

  const lineupReady = teams
    .filter((team) => team.is_active)
    .every((team) => (membersByTeam[team.id]?.length ?? 0) > 0 && isTeamReady(team))

  const voteTotals = useMemo(() => {
    const totalVotes = votes.length || 1
    return teams.map((team) => {
      const teamVotes = votes.filter((vote) => vote.game_team_id === team.id)
      return {
        team,
        count: teamVotes.length,
        percentage: Math.round((teamVotes.length / totalVotes) * 100),
        voters: teamVotes,
      }
    })
  }, [teams, votes])

  const perTeamScores = useMemo(() => {
    return teams.map((team) => {
      const teamVoters = votes.filter((vote) => vote.participant.game_team_id === team.id)
      const correct = teamVoters.filter((vote) => vote.game_team_id === losingTeamId).length
      const incorrect = losingTeamId ? teamVoters.length - correct : 0
      return { team, correct, incorrect, delta: correct - incorrect }
    })
  }, [losingTeamId, teams, votes])

  if (!round) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white/70 text-xl">Crea una ronda per a iniciar l&apos;espectacle.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Repte {round.sequence + 1}</p>
          <h1 className="text-4xl font-bold mt-2">{phaseLabels[phase] ?? phase}</h1>
          <p className="text-white/70 mt-2">
            {votes.length} / {totalPlayers} vots
            {pendingVotes > 0 && phase === 'voting' && (
              <span className="ml-2 text-white/50">({pendingVotes} pendents)</span>
            )}
          </p>
          {headline && (
            <p className="text-white mt-1">
              Titular: <span className="font-semibold">{headline}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {phase === 'leader_selection' && (
            <button
              onClick={() => onOpenVoting(headline.trim())}
              disabled={!headline.trim() || !lineupReady}
              className="bg-emerald-400 text-black font-semibold px-8 py-3 rounded-2xl disabled:opacity-50"
            >
              Obrir apostes
            </button>
          )}
          {phase === 'voting' && (
            <button
              onClick={onLockVoting}
              className="bg-yellow-300 text-black font-semibold px-8 py-3 rounded-2xl"
            >
              Tancar apostes
            </button>
          )}
        </div>
      </header>

      {challenge && (
        <section className="bg-black/30 border border-white/10 rounded-3xl p-5 space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Repte actual</p>
          <h2 className="text-3xl font-semibold">{challenge.title}</h2>
          {challenge.description && <p className="text-white/70 text-sm">{challenge.description}</p>}
          {requiredCount && (
            <p className="text-white/50 text-sm">{requiredCount} jugador(s) per equip competixen.</p>
          )}
        </section>
      )}

      {phase === 'leader_selection' && (
        <section className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <label className="text-sm uppercase tracking-[0.3em] text-white/50">Titular que veuran els jugadors</label>
            <textarea
              className="mt-3 w-full rounded-2xl bg-black/30 border border-white/10 p-4 text-lg"
              placeholder="Blau vs Verd"
              value={headline}
              onChange={(event) => setHeadline(event.target.value)}
            ></textarea>
            {!lineupReady && (
              <p className="text-amber-300 text-sm mt-2">
                Selecciona la alineació de cada equip actiu per a continuar.
              </p>
            )}
          </div>
          <LineupGrid
            teams={teams}
            membersByTeam={membersByTeam}
            lineupByTeam={lineupByTeam}
            requiredCount={requiredCount}
            onToggleLineup={onToggleLineup}
          />
        </section>
      )}

      {phase === 'voting' && <VotesPanel voteTotals={voteTotals} />}

      {phase === 'action' && (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
          <p className="text-white/70 text-lg">Repte en curs. Marca l&apos;equip que ha perdut quan ho sàpies.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {teams.map((team) => (
              <button
                key={team.id}
                style={{ backgroundColor: team.color_hex }}
                className="rounded-2xl text-white text-2xl font-semibold py-6 px-4 hover:opacity-90"
                onClick={() => onMarkLosingTeam(team.id)}
              >
                Marca {team.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'resolution' && (
        <section className="space-y-6">
          <VotesPanel voteTotals={voteTotals} revealNames losingTeamId={losingTeamId} />
          <Scoreboard perTeamScores={perTeamScores} />
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={onNextRound}
              className="flex-1 bg-blue-500 rounded-2xl py-4 text-xl font-semibold hover:bg-blue-400"
            >
              Següent repte
            </button>
            <button
              onClick={onEndGame}
              className="flex-1 bg-white/10 border border-white/20 rounded-2xl py-4 text-xl font-semibold"
            >
              Mostrar resultats finals
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function LineupGrid({
  teams,
  membersByTeam,
  lineupByTeam,
  requiredCount,
  onToggleLineup,
}: {
  teams: GameTeam[]
  membersByTeam: Record<string, Participant[]>
  lineupByTeam: Record<string, Participant[]>
  requiredCount: number | null
  onToggleLineup: (teamId: string, participantId: string, shouldAdd: boolean) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {teams.map((team) => {
        const members = membersByTeam[team.id] ?? []
        const selected = new Set((lineupByTeam[team.id] ?? []).map((player) => player.id))
        const limit = requiredCount ?? members.length

        return (
          <article key={team.id} className="bg-black/30 border border-white/10 rounded-3xl p-5">
            <header className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">{team.name}</p>
                <p className="text-white/70 text-sm">{members.length} jugadors</p>
              </div>
              <span className="text-white/60 text-sm">
                {selected.size}/{limit || '∞'} seleccionats
              </span>
            </header>
            <div className="space-y-2 mt-4 max-h-72 overflow-y-auto pr-2">
              {members.length === 0 && <p className="text-white/50 text-sm">Assigna jugadors a este equip.</p>}
              {members.map((player) => {
                const isPlaying = selected.has(player.id)
                const disableAdd = !isPlaying && limit !== 0 && selected.size >= limit
                return (
                  <button
                    key={player.id}
                    onClick={() => onToggleLineup(team.id, player.id, !isPlaying)}
                    disabled={disableAdd}
                    className={`w-full flex items-center justify-between rounded-2xl border px-4 py-2 text-left transition ${
                      isPlaying
                        ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                        : 'border-white/10 bg-white/5 text-white'
                    } ${disableAdd ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <span>{player.nickname}</span>
                    <span className="text-xs uppercase tracking-[0.3em]">
                      {isPlaying ? 'Jugant' : 'Banqueta'}
                    </span>
                  </button>
                )
              })}
            </div>
          </article>
        )
      })}
    </div>
  )
}

function VotesPanel({
  voteTotals,
  revealNames = false,
  losingTeamId,
}: {
  voteTotals: { team: GameTeam; count: number; percentage: number; voters: RoundVote[] }[]
  revealNames?: boolean
  losingTeamId?: string | null
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2">
      {voteTotals.map(({ team, count, percentage, voters }) => (
        <article key={team.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-3">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-white/50">{team.name}</p>
              <p className="text-3xl font-bold" style={{ color: team.color_hex }}>
                {percentage}%
              </p>
            </div>
            {losingTeamId && losingTeamId === team.id && (
              <span className="px-3 py-1 rounded-full bg-white/20 text-xs uppercase tracking-[0.3em]">
                Perdedor
              </span>
            )}
          </header>
          <div className="bg-black/30 rounded-full h-3 overflow-hidden">
            <div className="h-full" style={{ width: `${percentage}%`, backgroundColor: team.color_hex }}></div>
          </div>
          <p className="text-white/60 text-sm">{count} {count === 1 ? 'vot' : 'vots'}</p>
          {revealNames && (
            <div className="space-y-1 max-h-32 overflow-y-auto pr-2 text-sm">
              {voters.length === 0 && <p className="text-white/50">Ningú ha votat ací.</p>}
              {voters.map((vote) => (
                <div key={vote.id} className="bg-black/40 border border-white/5 rounded-xl px-3 py-1">
                  {vote.participant.nickname}
                </div>
              ))}
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function Scoreboard({
  perTeamScores,
}: {
  perTeamScores: { team: GameTeam; correct: number; incorrect: number; delta: number }[]
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {perTeamScores.map(({ team, correct, incorrect, delta }) => (
        <article key={team.id} className="bg-black/30 border border-white/10 rounded-3xl p-5">
          <header className="flex items-center justify-between">
            <h3 className="text-xl font-semibold" style={{ color: team.color_hex }}>
              {team.name}
            </h3>
            <span className={`text-2xl font-bold ${delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {delta >= 0 ? '+' : ''}
              {delta}
            </span>
          </header>
          <p className="text-white/60 text-sm mt-2">
            {correct} encerts • {incorrect} errors
          </p>
        </article>
      ))}
    </div>
  )
}
