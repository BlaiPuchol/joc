import { VOTE_REWARD_PER_CORRECT } from '@/constants'
import { TeamLeaderboard } from '@/components/team-leaderboard'
import { useTeamScores } from '@/hooks/useTeamScores'
import {
  GameChallenge,
  GameRound,
  GameTeam,
  Participant,
  RoundLineup,
  RoundOutcome,
  RoundVote,
  TeamScore,
} from '@/types/types'
import { useEffect, useMemo, useState } from 'react'

type Phase = 'leader_selection' | 'voting' | 'action' | 'resolution'

type LineupEntry = RoundLineup & { participant: Participant }

type Props = {
  gameId: string
  phase: Phase | 'lobby'
  round: GameRound | null
  challenge: GameChallenge | null
  participants: Participant[]
  teams: GameTeam[]
  votes: RoundVote[]
  lineups: LineupEntry[]
  outcomes: RoundOutcome[]
  onOpenVoting: (notes: string) => void
  onLockVoting: () => void
  onUpdateOutcome: (teamId: string, updates: { isLoser?: boolean; challengePoints?: number }) => void
  onFinalizeResults: () => void
  onNextRound: () => void
  onEndGame: () => void
}

export default function RoundController({
  gameId,
  phase,
  round,
  challenge,
  participants,
  teams,
  votes,
  lineups,
  outcomes,
  onOpenVoting,
  onLockVoting,
  onUpdateOutcome,
  onFinalizeResults,
  onNextRound,
  onEndGame,
}: Props) {
  const [showRanking, setShowRanking] = useState(false)
  const phaseLabels: Record<Phase | 'lobby', string> = {
    leader_selection: 'Selecció de líders',
    voting: 'Apostes obertes',
    action: 'Repte en marxa',
    resolution: 'Resolució',
    lobby: 'Sala d\'espera',
  }

  const { scores: teamScores, loading: rankingLoading, reload: reloadTeamScores } = useTeamScores(gameId, {
    refreshIntervalMs: showRanking ? 4000 : undefined,
  })

  useEffect(() => {
    if (showRanking) {
      reloadTeamScores()
    }
  }, [showRanking, reloadTeamScores])
  const totalPlayers = participants.length
  const pendingVotes = Math.max(totalPlayers - votes.length, 0)
  const losingTeamIds = useMemo(() => {
    return new Set(outcomes.filter((outcome) => outcome.is_loser).map((outcome) => outcome.team_id))
  }, [outcomes])

  const challengePointsByTeam = useMemo(() => {
    return outcomes.reduce<Record<string, number>>((acc, outcome) => {
      acc[outcome.team_id] = (acc[outcome.team_id] ?? 0) + outcome.challenge_points
      return acc
    }, {})
  }, [outcomes])

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

  const activeTeams = teams.filter((team) => team.is_active)
  const readyTeams = activeTeams.filter((team) => (membersByTeam[team.id]?.length ?? 0) > 0 && isTeamReady(team))
  const lineupReady = activeTeams.every((team) => (membersByTeam[team.id]?.length ?? 0) > 0 && isTeamReady(team))

  const lineupSummary = useMemo(() => {
    return teams
      .map((team) => {
        const selection = lineupByTeam[team.id] ?? []
        if (selection.length === 0) return `${team.name}: —`
        return `${team.name}: ${selection.map((player) => player.nickname).join(', ')}`
      })
      .join(' | ')
  }, [lineupByTeam, teams])

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
      const correctVotes = teamVoters.filter((vote) => losingTeamIds.has(vote.game_team_id)).length
      const votePoints = correctVotes * VOTE_REWARD_PER_CORRECT
      const challengePoints = challengePointsByTeam[team.id] ?? 0
      const total = votePoints + challengePoints
      return { team, correctVotes, votePoints, challengePoints, total }
    })
  }, [challengePointsByTeam, losingTeamIds, teams, votes])

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
          {activeTeams.length > 0 && (
            <p className="text-white mt-1">
              Alineacions: <span className="font-semibold">{readyTeams.length} / {activeTeams.length}</span> equips preparats
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {phase === 'leader_selection' && (
            <button
              onClick={() => onOpenVoting(lineupSummary)}
              disabled={!lineupReady}
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
            <p className="text-sm uppercase tracking-[0.3em] text-white/50">Progrés de selecció</p>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mt-3">
              <div>
                <p className="text-4xl font-semibold">{readyTeams.length} / {activeTeams.length}</p>
                <p className="text-white/70">Equips amb alineació confirmada</p>
              </div>
              {!lineupReady ? (
                <p className="text-amber-300 text-sm">
                  Esperant que les persones líders confirmen les seues alineacions.
                </p>
              ) : (
                <p className="text-emerald-300 text-sm">Tots els equips estan llestos! Pots obrir les apostes.</p>
              )}
            </div>
          </div>
          <LineupGrid
            teams={teams}
            membersByTeam={membersByTeam}
            lineupByTeam={lineupByTeam}
            requiredCount={requiredCount}
          />
        </section>
      )}

      {phase === 'voting' && <VotesPanel voteTotals={voteTotals} losingTeamIds={losingTeamIds} />}

      {phase === 'action' && (
        <OutcomeConfigurator
          teams={activeTeams}
          outcomes={outcomes}
          onUpdateOutcome={onUpdateOutcome}
          onFinalizeResults={onFinalizeResults}
        />
      )}

      {phase === 'resolution' && (
        <section className="space-y-6">
          <VotesPanel voteTotals={voteTotals} revealNames losingTeamIds={losingTeamIds} />
          <Scoreboard perTeamScores={perTeamScores} />
          <div className="flex flex-col md:flex-row gap-4 flex-wrap">
            <button
              onClick={onNextRound}
              className="flex-1 bg-blue-500 rounded-2xl py-4 text-xl font-semibold hover:bg-blue-400"
            >
              Següent repte
            </button>
            <button
              onClick={() => setShowRanking(true)}
              className="flex-1 bg-white/15 border border-white/30 rounded-2xl py-4 text-xl font-semibold hover:bg-white/20"
            >
              Veure classificació
            </button>
            <button
              onClick={onEndGame}
              className="flex-1 bg-rose-500/20 border border-rose-300/40 rounded-2xl py-4 text-xl font-semibold text-rose-100"
            >
              Finalitzar partida
            </button>
          </div>
        </section>
      )}

      {showRanking && (
        <RankingModal
          scores={teamScores}
          loading={rankingLoading}
          onClose={() => setShowRanking(false)}
        />
      )}
    </div>
  )
}

function LineupGrid({
  teams,
  membersByTeam,
  lineupByTeam,
  requiredCount,
}: {
  teams: GameTeam[]
  membersByTeam: Record<string, Participant[]>
  lineupByTeam: Record<string, Participant[]>
  requiredCount: number | null
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
                return (
                  <div
                    key={player.id}
                    className={`w-full flex items-center justify-between rounded-2xl border px-4 py-2 text-left transition ${
                      isPlaying
                        ? 'border-emerald-400 bg-emerald-400/10 text-emerald-200'
                        : 'border-white/10 bg-white/5 text-white/80'
                    }`}
                  >
                    <span>{player.nickname}</span>
                    <span className="text-xs uppercase tracking-[0.3em]">
                      {isPlaying ? 'En joc' : 'Banqueta'}
                    </span>
                  </div>
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
  losingTeamIds = new Set<string>(),
}: {
  voteTotals: { team: GameTeam; count: number; percentage: number; voters: RoundVote[] }[]
  revealNames?: boolean
  losingTeamIds?: Set<string>
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
            {losingTeamIds.has(team.id) && (
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
  perTeamScores: {
    team: GameTeam
    correctVotes: number
    votePoints: number
    challengePoints: number
    total: number
  }[]
}) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {perTeamScores.map(({ team, correctVotes, votePoints, challengePoints, total }) => (
        <article key={team.id} className="bg-black/30 border border-white/10 rounded-3xl p-5">
          <header className="flex items-center justify-between">
            <h3 className="text-xl font-semibold" style={{ color: team.color_hex }}>
              {team.name}
            </h3>
            <span className="text-3xl font-bold text-emerald-300">
              +{total}
            </span>
          </header>
          <dl className="text-white/70 text-sm mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <dt className="uppercase tracking-[0.3em] text-xs">Apostes encertades</dt>
              <dd className="font-semibold text-white">
                +{votePoints} pts <span className="text-white/50">({correctVotes})</span>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="uppercase tracking-[0.3em] text-xs">Punts del repte</dt>
              <dd className="font-semibold text-white">+{challengePoints} pts</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}

function OutcomeConfigurator({
  teams,
  outcomes,
  onUpdateOutcome,
  onFinalizeResults,
}: {
  teams: GameTeam[]
  outcomes: RoundOutcome[]
  onUpdateOutcome: (teamId: string, updates: { isLoser?: boolean; challengePoints?: number }) => void
  onFinalizeResults: () => void
}) {
  const losingTeamIds = useMemo(() => {
    return new Set(outcomes.filter((outcome) => outcome.is_loser).map((outcome) => outcome.team_id))
  }, [outcomes])

  const outcomeByTeam = useMemo(() => {
    return outcomes.reduce<Record<string, RoundOutcome>>((acc, outcome) => {
      acc[outcome.team_id] = outcome
      return acc
    }, {})
  }, [outcomes])

  const readyToReveal = losingTeamIds.size > 0

  return (
    <section className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
      <header className="space-y-2 text-center md:text-left">
        <p className="text-sm uppercase tracking-[0.3em] text-white/50">Repte en marxa</p>
        <h2 className="text-3xl font-semibold">Marca els equips perdedors i reparteix punts</h2>
        <p className="text-white/70 text-sm">
          Pots seleccionar els equips que han perdut i, si cal, sumar punts addicionals del repte a qualsevol equip.
          Les apostes correctes sumen {VOTE_REWARD_PER_CORRECT} punts per jugadora del seu equip.
        </p>
      </header>
      <div className="space-y-4">
        {teams.map((team) => {
          const entry = outcomeByTeam[team.id]
          const isLoser = entry?.is_loser ?? false
          const challengePoints = entry?.challenge_points ?? 0
          return (
            <article key={team.id} className="border border-white/10 rounded-2xl p-4 bg-black/20 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-white/40">{team.name}</p>
                  <p className="text-white/70 text-sm">
                    {isLoser ? 'Marcat com a perdedor/a' : 'Encara sense resultat'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={() => onUpdateOutcome(team.id, { isLoser: !isLoser })}
                    className={`px-4 py-2 rounded-2xl border text-sm font-semibold transition ${
                      isLoser
                        ? 'border-rose-300/60 bg-rose-400/20 text-rose-100'
                        : 'border-white/20 bg-white/10 text-white/80'
                    }`}
                  >
                    {isLoser ? 'Perdedor seleccionat' : 'Marcar com perdedor'}
                  </button>
                  <label className="flex items-center gap-2 text-sm text-white/70">
                    <span>Punts del repte</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="w-20 rounded-xl bg-black/40 border border-white/20 px-2 py-1 text-right text-white"
                      value={challengePoints}
                      onChange={(event) =>
                        onUpdateOutcome(team.id, {
                          challengePoints: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                        })
                      }
                    />
                  </label>
                </div>
              </div>
            </article>
          )
        })}
        {teams.length === 0 && (
          <p className="text-white/60 text-center py-6">Encara no hi ha equips actius per a este repte.</p>
        )}
      </div>
      <div className="flex flex-col md:flex-row gap-4 md:items-center">
        <button
          onClick={onFinalizeResults}
          disabled={!readyToReveal}
          className="flex-1 bg-emerald-400 text-black font-semibold px-6 py-3 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Revelar resultats
        </button>
        <p className="text-white/60 text-sm md:flex-1">
          {readyToReveal
            ? 'Ja pots passar a la resolució i mostrar els resultats.'
            : 'Selecciona almenys un equip perdedor per a poder tancar el repte.'}
        </p>
      </div>
    </section>
  )
}

function RankingModal({
  scores,
  loading,
  onClose,
}: {
  scores: TeamScore[]
  loading: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-3xl bg-slate-950 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">Classificació global</p>
            <h2 className="text-3xl font-semibold mt-2">Rànquing d&apos;equips</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-sm uppercase tracking-[0.3em]"
          >
            Tancar
          </button>
        </div>
        {loading ? (
          <p className="text-center text-white/70 py-10">Actualitzant classificació…</p>
        ) : (
          <TeamLeaderboard scores={scores} dense />
        )}
      </div>
    </div>
  )
}
