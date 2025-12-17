import { GameChallenge, GameRound, GameTeam, Participant, RoundLineup, RoundOutcome, RoundVote } from '@/types/types'
import { useMemo } from 'react'

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
    lobby: "Esperant que l'amfitrió inicie el primer repte.",
    leader_selection: 'Esperant que els líders trien qui competix...',
    voting: "Aposta per l'equip que cregues que perdrà!",
    action: 'Repte en marxa... Bona sort!',
    resolution: 'Ja tenim resultats!',
    results: 'La partida ha acabat.',
  }

  const renderVotingGrid = () => (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 px-4 pb-12 max-w-4xl mx-auto">
      {teams.map((team) => (
        <button
          key={team.id}
          onClick={() => onVote(team.id)}
          disabled={phase !== 'voting'}
          style={{ backgroundColor: team.color_hex }}
          className={`rounded-2xl text-white font-semibold text-2xl py-8 px-6 transition shadow-lg shadow-black/20 border border-white/10
            ${
              playerVoteTeamId === team.id
                ? 'ring-4 ring-white'
                : 'ring-0'
            }
            ${phase !== 'voting' ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'}`}
        >
          <div className="flex justify-between items-center">
            <span>{team.name}</span>
            {playerVoteTeamId === team.id && (
              <span className="text-sm font-normal uppercase tracking-wide">
                La teua aposta
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col text-white">
      <div className="text-center pt-12 pb-6 px-4">
        <p className="text-sm uppercase tracking-[0.3em] text-white/60">Repte en directe</p>
        <h1 className="text-3xl font-bold mt-2">Ei, {participant.nickname}!</h1>
        <p className="mt-4 text-lg text-white/80">{statusCopy[phase]}</p>
      </div>

      {phase !== 'lobby' && playerTeam && (
        <section className="px-4 pb-6">
          <PlayerLineupPanel
            team={playerTeam}
            lineup={playerSelection}
            totalMembers={playerTeamMembers.length}
            requiredCount={requiredCount}
            ready={isTeamReady(playerTeam)}
          />
        </section>
      )}

      {phase === 'voting' && renderVotingGrid()}

      {phase === 'leader_selection' && (
        <section className="px-4 pb-12 w-full max-w-3xl mx-auto">
          {isLeader && playerTeam ? (
            <LeaderLineupSelector
              team={playerTeam}
              members={playerTeamMembers}
              selected={new Set(playerSelection.map((player) => player.id))}
              requiredCount={requiredCount}
              onToggle={(playerId, shouldAdd) => onToggleLineup(playerTeam.id, playerId, shouldAdd)}
            />
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-2xl px-5 py-6 text-center text-white/70 text-lg">
              {playerTeam
                ? 'La teua persona líder està triant qui jugarà aquest repte. Mantín-te a l\'espera!'
                : 'Esperant que l\'amfitrió assigne el teu equip.'}
            </div>
          )}
        </section>
      )}

      {phase === 'lobby' && (
        <MessageBlock text="Mantín-te a l'espera mentre l'amfitrió ho prepara tot." />
      )}

      {phase === 'action' && (
        <MessageBlock text="Repte en marxa... les apostes estan bloquejades!" />
      )}

      {phase === 'resolution' && (
        <div className="flex-grow w-full px-4 pb-16">
          <div className="text-center mb-8">
            {playerGuessedCorrectly && (
              <p className="text-2xl font-semibold text-green-400">
                Has encertat! 🎉
              </p>
            )}
            {hasRoundResults && playerVoteTeamId && !playerGuessedCorrectly && (
              <p className="text-2xl font-semibold text-red-400">
                No has encertat  — Has de beure!! <br /> Més sort en la pròxima ronda!
              </p>
            )}
            {!hasRoundResults && (
              <p className="text-xl text-white/70">
                Esperant que l&apos;amfitrió anuncie l&apos;equip perdedor.
              </p>
            )}
          </div>
          <TransparencyPanel
            groupedVotes={groupedVotes}
            losingTeamIds={losingTeamIds}
          />
        </div>
      )}
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
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {groupedVotes.map(({ team, voters }) => {
        const sortedVoters = [...voters].sort((a, b) =>
          a.participant.nickname.localeCompare(b.participant.nickname)
        )
        return (
          <div
            key={team.id}
            className="rounded-2xl border px-4 py-4 bg-white/5 backdrop-blur border-white/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide text-white/60">
                  {team.name}
                </p>
                <p className="text-3xl font-bold" style={{ color: team.color_hex }}>
                  {voters.length} {voters.length === 1 ? 'vot' : 'vots'}
                </p>
              </div>
              {losingTeamIds.has(team.id) && (
                <span className="px-3 py-1 rounded-full text-sm bg-white/20 font-semibold">
                  Equip perdedor
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2">
              {sortedVoters.length === 0 && (
                <p className="text-white/50 text-sm">Sense apostes</p>
              )}
              {sortedVoters.map((vote) => (
                <div
                  key={vote.id}
                  className="bg-white/10 rounded-lg px-3 py-2 text-sm"
                >
                  {vote.participant.nickname}
                </div>
              ))}
            </div>
          </div>
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
    <article className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">El teu equip</p>
          <h2 className="text-2xl font-semibold" style={{ color: team.color_hex }}>
            {team.name}
          </h2>
          <p className="text-xs text-white/50 mt-1">
            {lineup.length} / {limit || '∞'} jugadors confirmats
          </p>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full uppercase tracking-[0.3em] ${
            ready ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-white/60'
          }`}
        >
          {ready ? 'Llest' : 'Pendent'}
        </span>
      </header>
      <div className="space-y-2">
        {lineup.length === 0 && (
          <p className="text-white/60 text-sm">Encara no hi ha jugadors confirmats per a este repte.</p>
        )}
        {lineup.map((player) => (
          <div key={player.id} className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-sm flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: team.color_hex }}></span>
            <span>{player.nickname}</span>
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
    <article className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-white/60">Alineació de {team.name}</p>
        <h2 className="text-2xl font-semibold">Tria qui competirà hui</h2>
        <p className="text-white/70 text-sm">
          Selecciona fins a {maxSelectable || '∞'} jugador(s). Pots tocar un nom per a afegir-lo o llevar-lo.
        </p>
      </header>
      <div className="space-y-2">
        {members.length === 0 && (
          <p className="text-white/60 text-sm">Encara no tens companys assignats al teu equip.</p>
        )}
        {members.map((member) => {
          const isPlaying = selected.has(member.id)
          const disableAdd = !isPlaying && maxSelectable !== 0 && selected.size >= maxSelectable
          return (
            <button
              key={member.id}
              onClick={() => onToggle(member.id, !isPlaying)}
              disabled={disableAdd}
              className={`w-full flex items-center justify-between rounded-2xl border px-4 py-2 text-left transition ${
                isPlaying
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-white'
              } ${disableAdd ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <span>{member.nickname}</span>
              <span className="text-xs uppercase tracking-[0.3em]">
                {isPlaying ? 'En joc' : 'Banqueta'}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-white/60 text-sm">
        {selected.size} / {maxSelectable || '∞'} jugadors seleccionats
      </p>
      {maxSelectable > 0 && selected.size === maxSelectable && (
        <p className="text-emerald-300 text-sm">Alineació completa! Espera que l&apos;amfitrió òbriga les apostes.</p>
      )}
    </article>
  )
}

function MessageBlock({ text }: { text: string }) {
  return (
    <div className="flex-grow flex items-center justify-center px-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-12 text-center text-xl text-white/80 max-w-xl">
        {text}
      </div>
    </div>
  )
}
