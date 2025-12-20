import { GameChallenge, GameRound, GameTeam, Participant, RoundLineup, RoundOutcome, RoundVote } from '@/types/types'
import { useEffect, useMemo, useRef, useState } from 'react'

const hexToRgba = (hex?: string | null, alpha = 1) => {
  if (!hex) return `rgba(15, 23, 42, ${alpha})`
  const sanitized = hex.replace('#', '')
  if (sanitized.length !== 6) return `rgba(15, 23, 42, ${alpha})`
  const r = parseInt(sanitized.slice(0, 2), 16)
  const g = parseInt(sanitized.slice(2, 4), 16)
  const b = parseInt(sanitized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

type LineupEntry = RoundLineup & { participant: Participant }

type Phase =
  | 'lobby'
  | 'leader_selection'
  | 'voting'
  | 'action'
  | 'resolution'
  | 'results'

export default function Challenge({
  phase,
  participant,
  round,
  teams,
  votes,
  outcomes,
  playerVoteTeamId,
  roster,
  lineups,
  challenge,
  onVote,
  onToggleLineup,
}: {
  phase: Phase
  participant: Participant
  round: GameRound | null
  teams: GameTeam[]
  votes: RoundVote[]
  outcomes: RoundOutcome[]
  playerVoteTeamId: string | null
  roster: Participant[]
  lineups: LineupEntry[]
  challenge: GameChallenge | null
  onVote: (teamId: string) => void
  onToggleLineup: (teamId: string, participantId: string, shouldAdd: boolean) => void
}) {
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
      acc[team.id] = roster.filter((member) => member.game_team_id === team.id)
      return acc
    }, {})
  }, [roster, teams])

  const playerTeam = teams.find((team) => team.id === participant.game_team_id) ?? null
  const isLeader = playerTeam ? playerTeam.leader_participant_id === participant.id : false
  const [leaderNotificationVisible, setLeaderNotificationVisible] = useState(false)
  const previousLeaderState = useRef(isLeader)

  useEffect(() => {
    if (isLeader && !previousLeaderState.current) {
      setLeaderNotificationVisible(true)
    }
    if (!isLeader) {
      setLeaderNotificationVisible(false)
    }
    previousLeaderState.current = isLeader
  }, [isLeader])

  useEffect(() => {
    if (!leaderNotificationVisible) return
    const timeout = setTimeout(() => setLeaderNotificationVisible(false), 5000)
    return () => clearTimeout(timeout)
  }, [leaderNotificationVisible])

  const requiredCount = challenge?.participants_per_team ?? null

  const isTeamReady = (team: GameTeam) => {
    const selection = lineupByTeam[team.id] ?? []
    if (!requiredCount) {
      return selection.length > 0
    }
    return selection.length === requiredCount
  }

  const activeTeams = teams.filter((team) => team.is_active)
  const lineupReady = activeTeams.every(
    (team) => (membersByTeam[team.id]?.length ?? 0) > 0 && isTeamReady(team)
  )
  const playerTeamMembers = playerTeam ? membersByTeam[playerTeam.id] ?? [] : []
  const playerSelection = playerTeam ? lineupByTeam[playerTeam.id] ?? [] : []
  const losingTeamIds = useMemo(() => {
    return new Set(outcomes.filter((outcome) => outcome.is_loser).map((outcome) => outcome.team_id))
  }, [outcomes])
  const hasRoundResults = losingTeamIds.size > 0
  const playerGuessedCorrectly = hasRoundResults && !!playerVoteTeamId && losingTeamIds.has(playerVoteTeamId)

  const groupedVotes = useMemo(() => {
    return teams.map((team) => ({
      team,
      voters: votes.filter((vote) => vote.game_team_id === team.id),
    }))
  }, [teams, votes])

  const statusCopy: Record<Phase, string> = {
    lobby: 'Preparant el primer repte.',
    leader_selection: 'Les persones líders estan triant la seua alineació.',
    voting: 'És moment de votar el proper equip perdedor.',
    action: 'Repte en curs. Respira i disfruta.',
    resolution: 'Resultats a punt per a revelar-se.',
    results: 'La partida ha acabat.',
  }

  const accentColor = playerTeam?.color_hex ?? '#38bdf8'
  const screenBackground = `radial-gradient(circle at 20% 20%, ${hexToRgba(accentColor, 0.35)}, transparent 45%), #020617`
  const heroBackground = `linear-gradient(135deg, ${hexToRgba(accentColor, 0.5)}, rgba(2, 6, 23, 0.9))`
  const shouldRevealChallenge = ['voting', 'action', 'resolution'].includes(phase) && !!challenge
  const heroTitle = shouldRevealChallenge ? challenge?.title ?? `Ei, ${participant.nickname}!` : `Ei, ${participant.nickname}!`
  const heroDescription = shouldRevealChallenge ? challenge?.description ?? null : null

  const renderVotingGrid = () => (
    <section className="space-y-6">
      <header className="text-center space-y-3">
        <p className="text-xs uppercase tracking-[0.5em] text-white/60">Aposta ràpida</p>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight">Quin equip quedarà últim?</h2>
        <p className="text-base md:text-xl text-white/70 max-w-3xl mx-auto">
          Toca una targeta per a bloquejar la teua aposta.
        </p>
      </header>
      <div className="game-grid grid-cols-1 md:grid-cols-2">
        {teams.map((team) => {
          const isSelected = playerVoteTeamId === team.id
          return (
            <button
              key={team.id}
              onClick={() => onVote(team.id)}
              disabled={phase !== 'voting'}
              className={`tactile-button relative overflow-hidden text-left text-white px-6 py-8 sm:py-12 min-h-[160px] flex flex-col justify-between shadow-[0_20px_60px_rgba(0,0,0,0.35)]
                ${phase !== 'voting' ? 'opacity-60 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.99]'}
              `}
              style={{
                backgroundImage: `linear-gradient(145deg, ${hexToRgba(team.color_hex, 0.9)}, ${hexToRgba(team.color_hex, 0.65)})`,
                boxShadow: isSelected ? `0 0 0 4px rgba(255,255,255,0.9)` : undefined,
              }}
            >
              <div className="absolute inset-0 opacity-25" style={{
                background: `radial-gradient(circle at top left, rgba(255,255,255,0.4), transparent 55%)`,
              }}></div>
              <div className="relative z-10 space-y-4">
                <span className="text-sm uppercase tracking-[0.4em] text-white/80">Equip</span>
                <p className="text-3xl md:text-4xl font-black leading-tight break-words">{team.name}</p>
                {isSelected && (
                  <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em]">
                    Aposta enviada
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="min-h-screen" style={{ background: screenBackground }}>
      <div className="screen-frame py-10 flex flex-col gap-10 text-white">
        <section
          className="glow-panel relative overflow-hidden p-8 md:p-12"
          style={{ background: heroBackground }}
        >
          <div className="relative z-10 space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.4em] text-white/80">
              <span className="px-4 py-2 rounded-full bg-white/20">
                {phase === 'voting' ? 'Apostes obertes' : 'Repte en directe'}
              </span>
              {round && (
                <span className="px-4 py-2 rounded-full bg-white/10">
                  {round.sequence} Rondes 
                </span>
              )}
              {playerTeam && (
                <span
                  className="px-4 py-2 rounded-full"
                  style={{ backgroundColor: hexToRgba(accentColor, 0.25) }}
                >
                  {playerTeam.name}
                </span>
              )}
            </div>
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">
                {heroTitle}
              </h1>
              {heroDescription && (
                <p className="text-lg md:text-2xl text-white/90 max-w-4xl">
                  {heroDescription}
                </p>
              )}
              <p className="text-base md:text-xl text-white/80 font-medium">
                {statusCopy[phase]}
              </p>
            </div>
          </div>
          <div className="absolute inset-y-0 right-0 w-1/3 pointer-events-none opacity-40 blur-3xl" style={{
            background: `radial-gradient(circle at center, rgba(255,255,255,0.6), transparent 60%)`,
          }}></div>
        </section>

        {playerTeam && leaderNotificationVisible && (
          <div className="glow-panel border border-emerald-400/40 bg-emerald-500/10 text-center text-lg md:text-xl font-semibold text-emerald-100 px-6 py-5">
            {playerTeam.leader_participant_id === participant.id
              ? `Has sigut nomenat/da líder de ${playerTeam.name}. Tria qui jugarà aquesta ronda!`
              : `${playerTeam.name} ja té lideratge assignat.`}
          </div>
        )}

        {phase !== 'lobby' && playerTeam && (
          <PlayerLineupPanel
            team={playerTeam}
            lineup={playerSelection}
            totalMembers={playerTeamMembers.length}
            requiredCount={requiredCount}
            ready={isTeamReady(playerTeam)}
          />
        )}

        {phase === 'leader_selection' && (
          isLeader && playerTeam ? (
            <LeaderLineupSelector
              team={playerTeam}
              members={playerTeamMembers}
              selected={new Set(playerSelection.map((player) => player.id))}
              requiredCount={requiredCount}
              onToggle={(playerId, shouldAdd) => onToggleLineup(playerTeam.id, playerId, shouldAdd)}
            />
          ) : (
            <div className="glow-panel p-6 md:p-10 text-center text-xl md:text-2xl font-semibold text-white/80">
              {playerTeam
                ? 'La teua persona líder està ultimant qui competirà. Guarda el mòbil a mà!'
                : 'Encara no se t\'ha assignat equip; espera instruccions de l\'amfitrió.'}
            </div>
          )
        )}

        {phase === 'voting' && renderVotingGrid()}

        {phase === 'lobby' && (
          <MessageBlock text="Mantín-te a l'espera mentre l'amfitrió ho prepara tot." />
        )}

        {phase === 'action' && (
          <MessageBlock text="Repte en marxa. Les apostes romandran bloquejades fins al final!" />
        )}

        {phase === 'resolution' && (
          <section className="space-y-8 pb-8">
            <div className="text-center space-y-3">
              {playerGuessedCorrectly && (
                <p className="text-3xl font-bold text-emerald-300">
                  Has encertat! 🎉
                </p>
              )}
              {hasRoundResults && playerVoteTeamId && !playerGuessedCorrectly && (
                <p className="text-3xl font-bold text-rose-300">
                  Esta vegada no has encertat. Prepara la pròxima ronda!
                </p>
              )}
              {!hasRoundResults && (
                <p className="text-2xl text-white/80">
                  Esperant que l&apos;amfitrió publique l&apos;equip perdedor…
                </p>
              )}
            </div>
            <TransparencyPanel groupedVotes={groupedVotes} losingTeamIds={losingTeamIds} />
          </section>
        )}
      </div>
    </div>
  )
}

function TransparencyPanel({
  groupedVotes,
  losingTeamIds,
}: {
  groupedVotes: { team: GameTeam; voters: RoundVote[] }[]
  losingTeamIds: Set<string>
}) {
  const totalVotes = groupedVotes.reduce((sum, entry) => sum + entry.voters.length, 0) || 1
  return (
    <div className="game-grid grid-cols-1 md:grid-cols-2">
      {groupedVotes.map(({ team, voters }) => {
        const sortedVoters = [...voters].sort((a, b) =>
          a.participant.nickname.localeCompare(b.participant.nickname)
        )
        const isLoser = losingTeamIds.has(team.id)
        return (
          <article
            key={team.id}
            className="relative overflow-hidden glow-panel p-6 md:p-8"
            style={{
              borderColor: hexToRgba(team.color_hex, 0.4),
              background: `linear-gradient(140deg, ${hexToRgba(team.color_hex, 0.4)}, rgba(2, 6, 23, 0.95))`,
            }}
          >
            <div className="relative z-10 space-y-4">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.5em] text-white/70">{team.name}</p>
                  <p className="text-4xl font-black">
                    {voters.length} {voters.length === 1 ? 'vot' : 'vots'}
                  </p>
                </div>
                {isLoser && (
                  <span className="px-4 py-2 rounded-full text-xs uppercase tracking-[0.4em] bg-white/20">
                    Perdedor
                  </span>
                )}
              </header>
              <div className="bg-white/25 rounded-full h-3" role="meter" aria-valuenow={voters.length}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((voters.length / totalVotes) * 100)}%`,
                    backgroundColor: '#ffffff',
                  }}
                ></div>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-2 text-sm">
                {sortedVoters.length === 0 && (
                  <p className="text-white/70">Sense apostes registrades.</p>
                )}
                {sortedVoters.map((vote) => (
                  <div key={vote.id} className="bg-white/15 rounded-2xl px-3 py-2">
                    {vote.participant.nickname}
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 opacity-20" style={{
              background: 'radial-gradient(circle at top right, rgba(255,255,255,0.6), transparent 60%)',
            }}></div>
          </article>
        )
      })}
    </div>
  )
}

function PlayerLineupPanel({
  team,
  lineup,
  totalMembers,
  requiredCount,
  ready,
}: {
  team: GameTeam
  lineup: Participant[]
  totalMembers: number
  requiredCount: number | null
  ready: boolean
}) {
  const limit = requiredCount ?? totalMembers
  return (
    <article
      className="glow-panel p-6 md:p-10 space-y-5"
      style={{
        background: `linear-gradient(120deg, ${hexToRgba(team.color_hex, 0.55)}, rgba(2, 6, 23, 0.95))`,
        borderColor: hexToRgba(team.color_hex, 0.45),
        boxShadow: `0 35px 90px ${hexToRgba(team.color_hex, 0.35)}`,
      }}
    >
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.5em] text-white/70">El teu equip</p>
          <h2 className="text-3xl md:text-4xl font-black leading-tight">{team.name}</h2>
          <p className="text-sm text-white/80 mt-2">
            {lineup.length} / {limit || '∞'} jugadors confirmats
          </p>
        </div>
        <span
          className={`px-6 py-2 rounded-full text-xs uppercase tracking-[0.4em] ${
            ready ? 'bg-emerald-300 text-black' : 'bg-white/15 text-white'
          }`}
        >
          {ready ? 'Llest' : 'En curs'}
        </span>
      </header>
      <div className="space-y-3">
        {lineup.length === 0 && (
          <p className="text-white/70 text-base">Encara no hi ha jugadors confirmats per a este repte.</p>
        )}
        {lineup.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-3 text-lg bg-white/10 rounded-2xl px-4 py-3"
            style={{ borderLeft: `6px solid ${team.color_hex}` }}
          >
            <span className="font-semibold">{player.nickname}</span>
          </div>
        ))}
      </div>
    </article>
  )
}

function LeaderLineupSelector({
  team,
  members,
  selected,
  requiredCount,
  onToggle,
}: {
  team: GameTeam
  members: Participant[]
  selected: Set<string>
  requiredCount: number | null
  onToggle: (participantId: string, shouldAdd: boolean) => void
}) {
  const limit = requiredCount ?? members.length
  const maxSelectable = limit === 0 ? members.length : limit
  return (
    <article
      className="glow-panel space-y-5 p-6 md:p-8"
      style={{
        borderColor: hexToRgba(team.color_hex, 0.35),
        boxShadow: `0 25px 70px ${hexToRgba(team.color_hex, 0.25)}`,
      }}
    >
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.5em] text-white/60">Alineació de {team.name}</p>
        <h2 className="text-3xl font-semibold">Selecciona competidors</h2>
        <p className="text-white/80 text-base">
          Toca per a activar o desactivar fins a {maxSelectable || '∞'} jugadors. Penseu bé qui jugarà!
        </p>
      </header>
      <div className="space-y-3">
        {members.length === 0 && (
          <p className="text-white/70 text-base">Encara no tens companys assignats al teu equip.</p>
        )}
        {members.map((member) => {
          const isPlaying = selected.has(member.id)
          const disableAdd = !isPlaying && maxSelectable !== 0 && selected.size >= maxSelectable
          return (
            <button
              key={member.id}
              onClick={() => onToggle(member.id, !isPlaying)}
              disabled={disableAdd}
              className={`tactile-button w-full flex items-center justify-between px-5 py-4 text-left text-lg border-2 ${
                isPlaying
                  ? 'bg-emerald-400/20 border-emerald-300 text-emerald-100'
                  : 'bg-white/5 border-white/20 text-white'
              } ${disableAdd ? 'opacity-40 cursor-not-allowed' : 'hover:scale-[1.01]'}`}
            >
              <span className="font-semibold">{member.nickname}</span>
              <span className="text-xs uppercase tracking-[0.4em]">
                {isPlaying ? 'En joc' : 'Banqueta'}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-sm text-white/70">
        <span>{selected.size} / {maxSelectable || '∞'} jugadors</span>
        {maxSelectable > 0 && selected.size === maxSelectable && (
          <span className="text-emerald-300 font-semibold">Alineació completa</span>
        )}
      </div>
    </article>
  )
}

function MessageBlock({ text }: { text: string }) {
  return (
    <div className="glow-panel text-center text-2xl md:text-3xl font-semibold px-6 py-10">
      {text}
    </div>
  )
}
