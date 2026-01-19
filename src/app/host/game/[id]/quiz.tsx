import { VOTE_REWARD_PER_CORRECT } from '@/constants'
import { TeamLeaderboard } from '@/components/team-leaderboard'
import { FormattedText } from '@/components/formatted-text'
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

const hexToRgba = (hex?: string | null, alpha = 1) => {
  if (!hex) return `rgba(15, 23, 42, ${alpha})`
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return `rgba(15, 23, 42, ${alpha})`
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

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
  isLastRound: boolean
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
  isLastRound,
}: Props) {
  const [showRanking, setShowRanking] = useState(false)
  const [showEndGameConfirmation, setShowEndGameConfirmation] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [viewMode, setViewMode] = useState<'intro' | 'selection'>('intro')

  const phaseLabels: Record<Phase | 'lobby', string> = {
    leader_selection: 'Selecció de líders',
    voting: 'Apostes obertes',
    action: 'Repte en marxa',
    resolution: 'Resolució',
    lobby: "Sala d'espera",
  }

  const {
    scores: teamScores,
    loading: rankingLoading,
    reload: reloadTeamScores,
  } = useTeamScores(gameId, {
    refreshIntervalMs: showRanking ? 4000 : undefined,
  })

  useEffect(() => {
    if (showRanking) {
      reloadTeamScores()
    }
  }, [showRanking, reloadTeamScores])

  useEffect(() => {
    if (phase === 'leader_selection') {
      setViewMode('intro')
    }
  }, [phase, round?.id])

  const totalPlayers = participants.length
  const pendingVotes = Math.max(totalPlayers - votes.length, 0)
  const losingTeamIds = useMemo(() => {
    return new Set(
      outcomes.filter((outcome) => outcome.is_loser).map((outcome) => outcome.team_id)
    )
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
  const readyTeams = activeTeams.filter(
    (team) => (membersByTeam[team.id]?.length ?? 0) > 0 && isTeamReady(team)
  )
  const lineupReady = activeTeams.every(
    (team) => (membersByTeam[team.id]?.length ?? 0) > 0 && isTeamReady(team)
  )
  const showSelectionProgress = phase === 'leader_selection'

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

  const accentColor = teams.find((team) => team.is_active)?.color_hex ?? '#7c3aed'
  const screenBackground = `radial-gradient(circle at 15% 15%, ${hexToRgba(
    accentColor,
    0.3
  )}, transparent 40%), #020617`
  const heroBackground = `linear-gradient(135deg, ${hexToRgba(
    accentColor,
    0.45
  )}, rgba(2, 6, 23, 0.95))`

  if (!round) {
    return (
      <div
        className="h-screen w-screen overflow-hidden flex items-center justify-center"
        style={{ background: screenBackground }}
      >
        <div className="glow-panel px-8 py-10 text-center text-2xl text-white/80">
          Crea una ronda per a iniciar l&apos;espectacle.
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen w-screen overflow-hidden" style={{ background: screenBackground }}>
      <div className="h-full w-full px-4 sm:px-6 py-6 sm:py-10 text-white flex flex-col">
        {phase === 'leader_selection' ? (
          viewMode === 'intro' ? (
            <section
              className="glow-panel w-full h-full flex flex-col items-center justify-center p-12 text-center space-y-10"
              style={{ background: heroBackground }}
            >
              <div className="space-y-6 max-w-4xl">
                <p className="text-large uppercase tracking-[0.5em] text-white/60">
                  Repte {round.sequence + 1}
                </p>
                <h1 className="text-6xl md:text-7xl font-black leading-tight">
                  {challenge?.title ?? 'Repte en directe'}
                </h1>
                {challenge?.description && (
                  <p className="text-2xl md:text-3xl text-white/90 leading-relaxed">
                    {challenge.description}
                  </p>
                )}
                {/* {challenge?.rules && (
                  <div className="bg-white/5 rounded-2xl p-6 text-left border border-white/10 w-full">
                    <p className="text-sm uppercase tracking-[0.3em] text-emerald-400 mb-4 font-bold">Regles</p>
                    <FormattedText text={challenge.rules} className="text-xl md:text-2xl text-white/80" />
                  </div>
                )} */}
              </div>
              <button
                onClick={() => setViewMode('selection')}
                className="tactile-button bg-emerald-400 text-black text-xl font-bold px-12 py-6 rounded-2xl shadow-xl hover:scale-105 transition-transform"
              >
                Seleccionar jugadors
              </button>
            </section>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 h-full w-full">
              <section
                className="glow-panel lg:w-1/3 flex flex-col gap-6 p-8 shrink-0"
                style={{ background: heroBackground }}
              >
                <div className="space-y-4 shrink-0">
                  <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.5em] text-white/70">
                    <span className="px-3 py-1 rounded-full bg-white/15">
                      Repte {round.sequence + 1}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/10">Selecció</span>
                  </div>
                  <h2 className="text-6xl font-black leading-tight">
                    {challenge?.title ?? 'Repte en directe'}
                  </h2>
                  {challenge?.description && (
                    <p className="text-2xl text-white/80">{challenge.description}</p>
                  )}
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                  {challenge?.rules && (
                    <button
                      onClick={() => setShowRules(true)}
                      className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-6 text-left transition-colors flex items-center justify-between group"
                    >
                      <span className="text-sm uppercase tracking-[0.3em] text-emerald-400 font-bold">
                        Veure regles
                      </span>
                      <span className="text-white/60 text-2xl group-hover:scale-125 transition-transform">
                        📜
                      </span>
                    </button>
                  )}
                </div>

                <div className="space-y-4 shrink-0 mt-auto">
                  <dl className="grid grid-cols-2 gap-4 text-lg">
                    <div className="bg-white/5 rounded-xl p-4">
                      <dt className="text-xs uppercase tracking-[0.5em] text-white/60">
                        Equips llestos
                      </dt>
                      <dd className="text-3xl font-bold">
                        {readyTeams.length} / {activeTeams.length}
                      </dd>
                      {!lineupReady && (
                        <p className="text-sm text-amber-200 mt-1">
                          Encara confirmant alineacions
                        </p>
                      )}
                    </div>
                    <div className="bg-white/5 rounded-xl p-4">
                      <dt className="text-xs uppercase tracking-[0.5em] text-white/60">
                        Jugadors actius
                      </dt>
                      <dd className="text-3xl font-bold">{totalPlayers}</dd>
                      {requiredCount && (
                        <p className="text-sm text-white/70 mt-1">{requiredCount} per equip</p>
                      )}
                    </div>
                  </dl>

                  <button
                    onClick={() => onOpenVoting(lineupSummary)}
                    disabled={!lineupReady}
                    className="tactile-button w-full bg-emerald-400 text-black text-xl py-5 disabled:opacity-50"
                  >
                    Obrir apostes
                  </button>
                </div>
              </section>

              <section className="flex-1 min-h-0 overflow-y-auto rounded-3xl">
                <LineupGrid
                  teams={teams}
                  membersByTeam={membersByTeam}
                  lineupByTeam={lineupByTeam}
                  requiredCount={requiredCount}
                />
              </section>
            </div>
          )
        ) : phase === 'voting' ? (
          <div className="flex flex-col lg:flex-row gap-6 h-full w-full">
            <section
              className="glow-panel lg:w-1/3 flex flex-col gap-6 p-8 shrink-0"
              style={{ background: heroBackground }}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.5em] text-white/70">
                  <span className="px-3 py-1 rounded-full bg-white/15">
                    Repte {round.sequence + 1}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10">Apostes</span>
                </div>
                <h2 className="text-6xl font-black leading-tight">
                  {challenge?.title ?? 'Repte en directe'}
                </h2>
                {challenge?.description && (
                  <p className="text-2xl text-white/80">{challenge.description}</p>
                )}
              </div>

              <div className="space-y-4 flex-1">
                <dl className="grid grid-cols-2 gap-4 text-lg">
                  <div className="bg-white/5 rounded-xl p-4">
                    <dt className="text-xs uppercase tracking-[0.5em] text-white/60">
                      Vots registrats
                    </dt>
                    <dd className="text-3xl font-bold">{votes.length}</dd>
                    {pendingVotes > 0 && (
                      <p className="text-sm text-white/70 mt-1">{pendingVotes} pendents</p>
                    )}
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <dt className="text-xs uppercase tracking-[0.5em] text-white/60">
                      Jugadors actius
                    </dt>
                    <dd className="text-3xl font-bold">{totalPlayers}</dd>
                  </div>
                </dl>
              </div>

              <button
                onClick={onLockVoting}
                className="tactile-button w-full bg-yellow-300 text-black text-xl py-5 mt-auto"
              >
                Tancar apostes
              </button>
            </section>

            <section className="flex-1 min-h-0 overflow-y-auto rounded-3xl">
              <VotingDashboard
                voteTotals={voteTotals}
                lineupByTeam={lineupByTeam}
                losingTeamIds={losingTeamIds}
              />
            </section>
          </div>
        ) : phase === 'action' ? (
          <OutcomeConfigurator
            teams={activeTeams}
            outcomes={outcomes}
            onUpdateOutcome={onUpdateOutcome}
            onFinalizeResults={onFinalizeResults}
            challenge={challenge}
            round={round}
            onShowRules={() => setShowRules(true)}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 h-full w-full">
            <section
              className="glow-panel lg:w-1/3 flex flex-col gap-6 p-8 shrink-0"
              style={{ background: heroBackground }}
            >
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.5em] text-white/70">
                  <span className="px-3 py-1 rounded-full bg-white/15">
                    Repte {round.sequence + 1}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/10">Resultats</span>
                </div>
                <h2 className="text-6xl font-black leading-tight">
                  {challenge?.title ?? 'Repte en directe'}
                </h2>
                {challenge?.description && (
                  <p className="text-2xl text-white/80">{challenge.description}</p>
                )}
              </div>

              <div className="space-y-4 flex-1">
                <dl className="grid grid-cols-2 gap-4 text-lg">
                  <div className="bg-white/5 rounded-xl p-4">
                    <dt className="text-xs uppercase tracking-[0.5em] text-white/60">
                      Vots totals
                    </dt>
                    <dd className="text-3xl font-bold">{votes.length}</dd>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <dt className="text-xs uppercase tracking-[0.5em] text-white/60">
                      Punts repartits
                    </dt>
                    <dd className="text-3xl font-bold text-emerald-300">
                      +
                      {perTeamScores.reduce((acc, s) => acc + s.total, 0).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-3 mt-auto">
                {!isLastRound && (
                  <button
                    onClick={onNextRound}
                    className="tactile-button w-full bg-blue-500 text-white text-xl py-5"
                  >
                    Següent repte
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowRanking(true)}
                    className="tactile-button bg-white/15 border border-white/30 py-4 text-lg"
                  >
                    Classificació
                  </button>
                  <button
                    onClick={() => setShowEndGameConfirmation(true)}
                    className="tactile-button bg-rose-500/20 border border-rose-500/50 text-rose-200 py-4 text-lg"
                  >
                    Finalitzar
                  </button>
                </div>
              </div>
            </section>

            <section className="flex-1 min-h-0 overflow-y-auto rounded-3xl">
              <ResolutionDashboard
                perTeamScores={perTeamScores}
                voteTotals={voteTotals}
                losingTeamIds={losingTeamIds}
              />
            </section>
          </div>
        )}

        {showRanking && (
          <RankingModal
            scores={teamScores}
            loading={rankingLoading}
            onClose={() => setShowRanking(false)}
          />
        )}

        {showRules && challenge?.rules && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-4xl w-full max-h-[85vh] flex flex-col space-y-6 shadow-2xl relative">
              <button
                onClick={() => setShowRules(false)}
                className="absolute top-4 right-4 text-white/50 hover:text-white p-2"
              >
                ✕
              </button>

              <div className="space-y-2 shrink-0 border-b border-white/10 pb-4">
                <p className="text-sm uppercase tracking-[0.3em] text-emerald-400 font-bold">
                  Regles del repte
                </p>
                <h3 className="text-3xl font-bold">{challenge.title}</h3>
              </div>

              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                <FormattedText
                  text={challenge.rules}
                  className="text-xl md:text-2xl text-white/90 leading-relaxed space-y-4"
                />
              </div>

              <div className="pt-4 border-t border-white/10 shrink-0">
                <button
                  onClick={() => setShowRules(false)}
                  className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-xl transition-colors uppercase tracking-[0.2em]"
                >
                  Tancar
                </button>
              </div>
            </div>
          </div>
        )}

        {showEndGameConfirmation && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-8 max-w-md w-full space-y-6 text-center shadow-2xl">
              <h3 className="text-2xl font-bold text-white">Estàs segur de que vols acabar el joc?</h3>
              <p className="text-white/70">Aquesta acció no es pot desfer.</p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setShowEndGameConfirmation(false)}
                  className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                >
                  Cancel·lar
                </button>
                <button
                  onClick={() => {
                    onEndGame()
                    setShowEndGameConfirmation(false)
                  }}
                  className="px-6 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold transition-colors shadow-lg shadow-rose-500/20"
                >
                  Sí, acabar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function VotingDashboard({
  voteTotals,
  lineupByTeam,
  losingTeamIds = new Set<string>(),
}: {
  voteTotals: { team: GameTeam; count: number; percentage: number; voters: RoundVote[] }[]
  lineupByTeam: Record<string, Participant[]>
  losingTeamIds?: Set<string>
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full content-start">
      {voteTotals.map(({ team, count, percentage }) => {
        const lineup = lineupByTeam[team.id] ?? []
        return (
          <article
            key={team.id}
            className="glow-panel p-6 space-y-6 flex flex-col"
            style={{
              borderColor: hexToRgba(team.color_hex, 0.35),
              background: `linear-gradient(145deg, ${hexToRgba(
                team.color_hex,
                0.35
              )}, rgba(2, 6, 23, 0.95))`,
            }}
          >
            <header className="flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">{team.name}</p>
                <p className="text-5xl font-black mt-1">{percentage}%</p>
              </div>
              {losingTeamIds.has(team.id) && (
                <span className="px-4 py-2 rounded-full bg-white/20 text-xs uppercase tracking-[0.4em]">
                  Perdedor
                </span>
              )}
            </header>

            <div className="space-y-2 shrink-0">
              <div className="bg-white/25 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${percentage}%`, backgroundColor: '#fff' }}
                ></div>
              </div>
              <p className="text-white/80 text-lg text-right">
                {count} {count === 1 ? 'vot' : 'vots'}
              </p>
            </div>

            <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-2">
              <p className="text-xs uppercase tracking-[0.5em] text-white/60">Alineació</p>
              <div className="flex flex-wrap gap-2">
                {lineup.length === 0 && (
                  <p className="text-white/60 text-sm">Sense jugadors confirmats.</p>
                )}
                {lineup.map((player) => (
                  <div
                    key={player.id}
                    className="bg-white/15 rounded-full px-4 py-2 text-2xl font-semibold text-white shadow-sm"
                  >
                    {player.nickname}
                  </div>
                ))}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function SelectionProgressCard({
  readyTeams,
  totalTeams,
  lineupReady,
}: {
  readyTeams: number
  totalTeams: number
  lineupReady: boolean
}) {
  return (
    <aside className="rounded-3xl border border-white/20 bg-white/5 p-6 md:p-8 flex flex-col gap-4 h-full">
      <div>
        <p className="text-xs uppercase tracking-[0.5em] text-white/60">Progrés de selecció</p>
        <p className="text-4xl font-semibold">{readyTeams} / {totalTeams}</p>
      </div>
      <p className="text-white/80 text-lg">
        {lineupReady
          ? 'Tots els equips estan llestos. Obrir apostes quan vulgues.'
          : 'Esperant confirmació de totes les alineacions.'}
      </p>
    </aside>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full content-start">
      {teams.map((team) => {
        const members = membersByTeam[team.id] ?? []
        const selected = new Set((lineupByTeam[team.id] ?? []).map((player) => player.id))
        const limit = requiredCount ?? members.length

        return (
          <article
            key={team.id}
            className="glow-panel p-5 md:p-6 space-y-4 flex flex-col"
            style={{
              borderColor: hexToRgba(team.color_hex, 0.3),
              boxShadow: `0 20px 60px ${hexToRgba(team.color_hex, 0.25)}`,
            }}
          >
            <header className="flex items-center justify-between shrink-0">
              <div>
                <p className="text-lg uppercase tracking-[0.5em] text-white/60">Equip</p>
                <h3 className="text-4xl font-semibold" style={{ color: team.color_hex }}>
                  {team.name}
                </h3>
              </div>
              <span className="text-white text-3xl font-semibold">
                {selected.size}/{limit || '∞'}
              </span>
            </header>
            <div className="flex flex-wrap gap-3 content-start overflow-y-auto pr-2">
              {members.length === 0 && (
                <p className="text-white/70 text-base">Assigna jugadors a este equip.</p>
              )}
              {members.map((player) => {
                const isPlaying = selected.has(player.id)
                return (
                  <div
                    key={player.id}
                    className={`px-4 py-2 rounded-full border text-2xl font-semibold tracking-tight shadow-lg transition-all ${
                      isPlaying
                        ? 'border-emerald-400 bg-emerald-400/20 text-emerald-100'
                        : 'border-white/15 bg-white/5 text-white/70'
                    }`}
                  >
                    {player.nickname}
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

function ResolutionDashboard({
  perTeamScores,
  voteTotals,
  losingTeamIds,
}: {
  perTeamScores: {
    team: GameTeam
    correctVotes: number
    votePoints: number
    challengePoints: number
    total: number
  }[]
  voteTotals: { team: GameTeam; count: number; percentage: number; voters: RoundVote[] }[]
  losingTeamIds: Set<string>
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full content-start">
      {perTeamScores.map((score) => {
        const votes = voteTotals.find((v) => v.team.id === score.team.id)
        const percentage = votes?.percentage ?? 0
        const count = votes?.count ?? 0
        const voters = votes?.voters ?? []
        const isLoser = losingTeamIds.has(score.team.id)

        return (
          <article
            key={score.team.id}
            className="glow-panel p-6 flex flex-col gap-5"
            style={{
              borderColor: hexToRgba(score.team.color_hex, 0.35),
              background: `linear-gradient(145deg, ${hexToRgba(
                score.team.color_hex,
                0.2
              )}, rgba(2, 6, 23, 0.95))`,
            }}
          >
            <header className="flex items-start justify-between shrink-0">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/70">{score.team.name}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-5xl font-black">{percentage}%</span>
                  <span className="text-white/60 text-sm">({count} vots)</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-4xl font-black text-emerald-300">+{score.total}</span>
                {isLoser && (
                  <div className="mt-1">
                    <span className="text-base uppercase tracking-widest bg-red-800 text-rose-200 px-2 py-1 rounded">
                      Perdedor
                    </span>
                  </div>
                )}
              </div>
            </header>

            <div className="space-y-2 shrink-0">
              <div className="bg-white/20 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-1000 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-4 text-sm bg-black/20 p-3 rounded-xl shrink-0">
              <div>
                <dt className="text-white/60 text-xs uppercase tracking-wider">Apostes ({score.correctVotes} encerts)</dt>
                <dd className="font-mono text-lg">+{score.votePoints}</dd>
              </div>
              <div className="text-right">
                <dt className="text-white/60 text-xs uppercase tracking-wider">Repte</dt>
                <dd className="font-mono text-lg">+{score.challengePoints}</dd>
              </div>
            </dl>

            <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
              <p className="text-xs uppercase tracking-[0.5em] text-white/60">
                Apostadors en contra
              </p>
              <div className="flex flex-wrap gap-2">
                {voters.length === 0 && (
                  <span className="text-white/40 text-lg italic">Sense vots</span>
                )}
                {voters.map((v) => (
                  <span
                    key={v.id}
                    className="px-2 py-1 bg-white/10 rounded text-lg text-white/80"
                  >
                    {v.participant.nickname}
                  </span>
                ))}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function OutcomeConfigurator({
  teams,
  outcomes,
  onUpdateOutcome,
  onFinalizeResults,
  challenge,
  round,
  onShowRules,
}: {
  teams: GameTeam[]
  outcomes: RoundOutcome[]
  onUpdateOutcome: (
    teamId: string,
    updates: { isLoser?: boolean; challengePoints?: number }
  ) => void
  onFinalizeResults: () => void
  challenge: GameChallenge | null
  round: GameRound
  onShowRules: () => void
}) {
  const losingTeamIds = useMemo(() => {
    return new Set(
      outcomes.filter((outcome) => outcome.is_loser).map((outcome) => outcome.team_id)
    )
  }, [outcomes])

  const outcomeByTeam = useMemo(() => {
    return outcomes.reduce<Record<string, RoundOutcome>>((acc, outcome) => {
      acc[outcome.team_id] = outcome
      return acc
    }, {})
  }, [outcomes])

  const readyToReveal = losingTeamIds.size > 0

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full w-full">
      <section
        className="glow-panel lg:w-1/3 flex flex-col gap-6 p-8 shrink-0"
        style={{
          background: `linear-gradient(135deg, rgba(124, 58, 237, 0.45), rgba(2, 6, 23, 0.95))`,
        }}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.5em] text-white/70">
            <span className="px-3 py-1 rounded-full bg-white/15">
              Repte {round.sequence + 1}
            </span>
            <span className="px-3 py-1 rounded-full bg-white/10">En marxa</span>
          </div>
          <h2 className="text-6xl font-black leading-tight">
            {challenge?.title ?? 'Repte en directe'}
          </h2>
          {challenge?.description && (
            <p className="text-2xl text-white/80">{challenge.description}</p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
          {challenge?.rules ? (
            <button
              onClick={onShowRules}
              className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-6 text-left transition-colors flex items-center justify-between group"
            >
              <span className="text-sm uppercase tracking-[0.3em] text-emerald-400 font-bold">
                Veure regles
              </span>
              <span className="text-white/60 text-2xl group-hover:scale-125 transition-transform">
                📜
              </span>
            </button>
          ) : (
            <div className="bg-white/5 rounded-xl p-6 space-y-4 opacity-50">
              <p className="text-white/60 italic">No hi ha regles definides per a aquest repte.</p>
            </div>
          )}
        </div>

        <div className="space-y-3 mt-auto">
          <button
            onClick={onFinalizeResults}
            disabled={!readyToReveal}
            className="tactile-button w-full bg-emerald-400 text-black text-xl py-5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Revelar resultats
          </button>
          <p className="text-white/60 text-sm text-center">
            {readyToReveal
              ? 'Tot llest per a mostrar els resultats.'
              : 'Selecciona almenys un perdedor.'}
          </p>
        </div>
      </section>

      <section className="flex-1 min-h-0 overflow-y-auto rounded-3xl pr-2 space-y-4">
        {teams.map((team) => {
          const entry = outcomeByTeam[team.id]
          const isLoser = entry?.is_loser ?? false
          const challengePoints = entry?.challenge_points ?? 0
          return (
            <article
              key={team.id}
              className="rounded-3xl p-5 md:p-6 flex flex-col gap-4"
              style={{
                border: `2px solid ${hexToRgba(team.color_hex, 0.35)}`,
                background: `linear-gradient(140deg, ${hexToRgba(
                  team.color_hex,
                  0.35
                )}, rgba(2,6,23,0.9))`,
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.5em] text-white/70">
                    {team.name}
                  </p>
                  <p className="text-xl font-semibold">
                    {isLoser ? 'Marcat com a perdedor' : 'Encara sense resultat'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={() => onUpdateOutcome(team.id, { isLoser: !isLoser })}
                    className={`tactile-button px-5 py-3 text-sm uppercase tracking-[0.3em] ${
                      isLoser ? 'bg-rose-400 text-black' : 'bg-white/15 text-white'
                    }`}
                  >
                    {isLoser ? 'Perdedor' : 'Marcar perdedor'}
                  </button>
                  <label className="flex items-center gap-3 text-lg">
                    <span className="text-white/70">Punts repte</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="w-28 rounded-2xl bg-slate-900/70 border border-white/30 px-3 py-2 text-right text-white text-xl"
                      value={challengePoints}
                      onChange={(event) =>
                        onUpdateOutcome(team.id, {
                          challengePoints: Math.max(
                            0,
                            Math.floor(Number(event.target.value) || 0)
                          ),
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
          <div className="h-full flex items-center justify-center text-white/50 text-xl">
            No hi ha equips actius.
          </div>
        )}
      </section>
    </div>
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
      <div className="w-full max-w-5xl bg-slate-950 border border-white/10 rounded-3xl p-8 space-y-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">Classificació global</p>
            <h2 className="text-6xl font-black mt-2">Rànquing d&apos;equips</h2>
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
          <TeamLeaderboard scores={scores} dense={false} />
        )}
      </div>
    </div>
  )
}
