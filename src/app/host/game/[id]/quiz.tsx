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

  const accentColor = (teams.find((team) => team.is_active)?.color_hex) ?? '#7c3aed'
  const screenBackground = `radial-gradient(circle at 15% 15%, ${hexToRgba(accentColor, 0.3)}, transparent 40%), #020617`
  const heroBackground = `linear-gradient(135deg, ${hexToRgba(accentColor, 0.45)}, rgba(2, 6, 23, 0.95))`

  if (!round) {
    return (
      <div className="min-h-screen h-screen flex items-center justify-center" style={{ background: screenBackground }}>
        <div className="glow-panel px-8 py-10 text-center text-2xl text-white/80">
          Crea una ronda per a iniciar l&apos;espectacle.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen h-screen flex flex-col" style={{ background: screenBackground }}>
      <div className="screen-frame py-10 space-y-10 text-white flex-1 flex flex-col overflow-y-auto">
        <section
          className="glow-panel relative overflow-hidden p-8 md:p-12"
          style={{ background: heroBackground }}
        >
          <div
            className={`relative z-10 ${showSelectionProgress ? 'grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]' : ''}`}
          >
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.5em] text-white/70">
                <span className="px-4 py-2 rounded-full bg-white/15">Repte {round.sequence + 1}</span>
                <span className="px-4 py-2 rounded-full bg-white/10">{phaseLabels[phase] ?? phase}</span>
                <span className="px-4 py-2 rounded-full bg-white/5">
                  {votes.length} / {totalPlayers} vots
                </span>
              </div>
              <div className="space-y-4">
                <h1 className="text-4xl md:text-6xl font-black leading-tight">
                  {challenge?.title ?? 'Repte en directe'}
                </h1>
                {challenge?.description && (
                  <p className="text-lg md:text-2xl text-white/90 max-w-4xl">{challenge.description}</p>
                )}
              </div>
              <dl className="grid gap-6 sm:grid-cols-3 text-lg">
                <div>
                  <dt className="text-xs uppercase tracking-[0.5em] text-white/60">Vots registrats</dt>
                  <dd className="text-3xl font-bold">{votes.length}</dd>
                  {pendingVotes > 0 && phase === 'voting' && (
                    <p className="text-sm text-white/70">{pendingVotes} pendents</p>
                  )}
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.5em] text-white/60">Equips llestos</dt>
                  <dd className="text-3xl font-bold">{readyTeams.length} / {activeTeams.length}</dd>
                  {!lineupReady && (
                    <p className="text-sm text-amber-200">Encara confirmant alineacions</p>
                  )}
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.5em] text-white/60">Jugadors actius</dt>
                  <dd className="text-3xl font-bold">{totalPlayers}</dd>
                  {requiredCount && (
                    <p className="text-sm text-white/70">{requiredCount} per equip</p>
                  )}
                </div>
              </dl>
              <div className="flex flex-col md:flex-row gap-4">
                {phase === 'leader_selection' && (
                  <button
                    onClick={() => onOpenVoting(lineupSummary)}
                    disabled={!lineupReady}
                    className="tactile-button flex-1 bg-emerald-400 text-black text-xl py-5 disabled:opacity-50"
                  >
                    Obrir apostes
                  </button>
                )}
                {phase === 'voting' && (
                  <button
                    onClick={onLockVoting}
                    className="tactile-button flex-1 bg-yellow-300 text-black text-xl py-5"
                  >
                    Tancar apostes
                  </button>
                )}
              </div>
            </div>
            {showSelectionProgress && (
              <SelectionProgressCard
                readyTeams={readyTeams.length}
                totalTeams={activeTeams.length}
                lineupReady={lineupReady}
              />
            )}
          </div>
          <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
            background: 'radial-gradient(circle at top right, rgba(255,255,255,0.5), transparent 55%)',
          }}></div>
        </section>

        {phase === 'leader_selection' && (
          <section className="space-y-6">
            <LineupGrid
              teams={teams}
              membersByTeam={membersByTeam}
              lineupByTeam={lineupByTeam}
              requiredCount={requiredCount}
            />
          </section>
        )}

        {phase === 'voting' && (
          <div className="space-y-8">
            <VotingLineupSummary teams={activeTeams} lineupByTeam={lineupByTeam} />
            <VotesPanel voteTotals={voteTotals} losingTeamIds={losingTeamIds} />
          </div>
        )}

        {phase === 'action' && (
          <OutcomeConfigurator
            teams={activeTeams}
            outcomes={outcomes}
            onUpdateOutcome={onUpdateOutcome}
            onFinalizeResults={onFinalizeResults}
          />
        )}

        {phase === 'resolution' && (
          <section className="space-y-8">
            <VotesPanel voteTotals={voteTotals} revealNames losingTeamIds={losingTeamIds} />
            <Scoreboard perTeamScores={perTeamScores} />
            <div className="flex flex-col md:flex-row gap-4 flex-wrap">
              <button
                onClick={onNextRound}
                className="tactile-button flex-1 bg-blue-500 py-5 text-xl"
              >
                Següent repte
              </button>
              <button
                onClick={() => setShowRanking(true)}
                className="tactile-button flex-1 bg-white/15 border border-white/30 py-5 text-xl"
              >
                Veure classificació
              </button>
              <button
                onClick={onEndGame}
                className="tactile-button flex-1 bg-rose-500/30 border border-rose-200/60 py-5 text-xl text-rose-50"
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
    </div>
  )
}

function VotingLineupSummary({
  teams,
  lineupByTeam,
}: {
  teams: GameTeam[]
  lineupByTeam: Record<string, Participant[]>
}) {
  if (teams.length === 0) return null
  return (
    <section className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-white/60">Participants confirmats</p>
          <p className="text-2xl font-semibold">Qui jugarà este repte</p>
        </div>
        <p className="text-white/70 text-sm">Visible durant el període d&apos;apostes.</p>
      </div>
      <div className="game-grid grid-cols-1 md:grid-cols-2">
        {teams.map((team) => {
          const lineup = lineupByTeam[team.id] ?? []
          return (
            <article
              key={team.id}
              className="glow-panel p-5 space-y-3"
              style={{
                borderColor: hexToRgba(team.color_hex, 0.35),
                boxShadow: `0 20px 60px ${hexToRgba(team.color_hex, 0.2)}`,
              }}
            >
              <header className="flex items-center justify-between">
                <h3 className="text-xl font-semibold" style={{ color: team.color_hex }}>
                  {team.name}
                </h3>
                <span className="text-white/80 text-sm">{lineup.length} jugadors</span>
              </header>
              <div className="space-y-2">
                {lineup.length === 0 && (
                  <p className="text-white/60 text-sm">Encara no han confirmat jugadors.</p>
                )}
                {lineup.map((player) => (
                  <div
                    key={player.id}
                    className="bg-white/10 border border-white/10 rounded-2xl px-4 py-2 text-white"
                  >
                    {player.nickname}
                  </div>
                ))}
              </div>
            </article>
          )
        })}
      </div>
    </section>
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
    <div className="game-grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {teams.map((team) => {
        const members = membersByTeam[team.id] ?? []
        const selected = new Set((lineupByTeam[team.id] ?? []).map((player) => player.id))
        const limit = requiredCount ?? members.length

        return (
          <article
            key={team.id}
            className="glow-panel p-5 md:p-6 space-y-4"
            style={{
              borderColor: hexToRgba(team.color_hex, 0.3),
              boxShadow: `0 20px 60px ${hexToRgba(team.color_hex, 0.25)}`,
            }}
          >
            <header className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-white/60">Equip</p>
                <h3 className="text-2xl font-semibold" style={{ color: team.color_hex }}>
                  {team.name}
                </h3>
              </div>
              <span className="text-white text-lg font-semibold">
                {selected.size}/{limit || '∞'}
              </span>
            </header>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
              {members.length === 0 && <p className="text-white/70 text-base">Assigna jugadors a este equip.</p>}
              {members.map((player) => {
                const isPlaying = selected.has(player.id)
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between rounded-2xl px-4 py-3 text-lg border-2 ${
                      isPlaying
                        ? 'border-emerald-400 bg-emerald-400/15 text-emerald-100'
                        : 'border-white/15 bg-white/5 text-white'
                    }`}
                  >
                    <span>{player.nickname}</span>
                    <span className="text-xs uppercase tracking-[0.4em]">
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
    <section className="game-grid grid-cols-1 md:grid-cols-2">
      {voteTotals.map(({ team, count, percentage, voters }) => (
        <article
          key={team.id}
          className="glow-panel p-6 md:p-7 space-y-4"
          style={{
            borderColor: hexToRgba(team.color_hex, 0.35),
            background: `linear-gradient(145deg, ${hexToRgba(team.color_hex, 0.35)}, rgba(2, 6, 23, 0.95))`,
          }}
        >
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">{team.name}</p>
              <p className="text-4xl font-black">{percentage}%</p>
            </div>
            {losingTeamIds.has(team.id) && (
              <span className="px-4 py-2 rounded-full bg-white/20 text-xs uppercase tracking-[0.4em]">
                Perdedor
              </span>
            )}
          </header>
          <div className="bg-white/25 rounded-full h-4 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: '#fff' }}></div>
          </div>
          <p className="text-white/80 text-lg">
            {count} {count === 1 ? 'vot registrat' : 'vots registrats'}
          </p>
          {revealNames && (
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2 text-sm">
              {voters.length === 0 && <p className="text-white/70">Sense apostes en este equip.</p>}
              {voters.map((vote) => (
                <div key={vote.id} className="bg-white/15 rounded-2xl px-3 py-2">
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
    <div className="game-grid md:grid-cols-2">
      {perTeamScores.map(({ team, correctVotes, votePoints, challengePoints, total }) => (
        <article
          key={team.id}
          className="glow-panel p-6 space-y-4"
          style={{
            borderColor: hexToRgba(team.color_hex, 0.35),
            background: `linear-gradient(140deg, ${hexToRgba(team.color_hex, 0.35)}, rgba(2,6,23,0.95))`,
          }}
        >
          <header className="flex items-center justify-between">
            <h3 className="text-2xl font-bold" style={{ color: team.color_hex }}>
              {team.name}
            </h3>
            <span className="text-4xl font-black text-emerald-200">+{total}</span>
          </header>
          <dl className="space-y-3 text-lg">
            <div className="flex items-center justify-between">
              <dt className="text-white/70">Apostes encertades</dt>
              <dd className="font-semibold">
                +{votePoints} pts <span className="text-white/60">({correctVotes})</span>
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-white/70">Punts del repte</dt>
              <dd className="font-semibold">+{challengePoints} pts</dd>
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
    <section className="glow-panel p-6 md:p-10 space-y-6">
      <header className="space-y-3 text-center md:text-left">
        <p className="text-xs uppercase tracking-[0.5em] text-white/60">Repte en marxa</p>
        <h2 className="text-4xl font-semibold">Marca els perdedors i reparteix punts extra</h2>
        <p className="text-white/80 text-lg">
          Cada aposta encertada suma {VOTE_REWARD_PER_CORRECT} punts. Utilitza estes targetes per a afegir punts del repte
          o marcar qui ha perdut.
        </p>
      </header>
      <div className="space-y-4">
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
                background: `linear-gradient(140deg, ${hexToRgba(team.color_hex, 0.35)}, rgba(2,6,23,0.9))`,
              }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.5em] text-white/70">{team.name}</p>
                  <p className="text-xl font-semibold">
                    {isLoser ? 'Marcat com a perdedor' : 'Encara sense resultat'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    onClick={() => onUpdateOutcome(team.id, { isLoser: !isLoser })}
                    className={`tactile-button px-5 py-3 text-sm uppercase tracking-[0.3em] ${
                      isLoser
                        ? 'bg-rose-400 text-black'
                        : 'bg-white/15 text-white'
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
          <p className="text-white/70 text-center py-6 text-lg">Encara no hi ha equips actius per a este repte.</p>
        )}
      </div>
      <div className="flex flex-col md:flex-row gap-4 md:items-center">
        <button
          onClick={onFinalizeResults}
          disabled={!readyToReveal}
          className="tactile-button flex-1 bg-emerald-400 text-black text-xl py-5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Revelar resultats
        </button>
        <p className="text-white/70 text-base md:flex-1">
          {readyToReveal
            ? 'Ja pots passar a la resolució i mostrar els resultats.'
            : 'Selecciona almenys un equip perdedor per a tancar el repte.'}
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
