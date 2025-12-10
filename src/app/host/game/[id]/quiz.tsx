import { GameRound, Participant, RoundVote, Team } from '@/types/types'
import { useMemo, useState, useEffect } from 'react'

type Phase =
  | 'leader_selection'
  | 'voting'
  | 'action'
  | 'resolution'

export default function RoundController({
  phase,
  round,
  participants,
  teams,
  votes,
  onOpenVoting,
  onLockVoting,
  onMarkLosingTeam,
  onNextRound,
  onEndGame,
}: {
  phase: Phase | 'lobby'
  round: GameRound | null
  participants: Participant[]
  teams: Team[]
  votes: RoundVote[]
  onOpenVoting: (notes: string) => void
  onLockVoting: () => void
  onMarkLosingTeam: (teamId: string) => void
  onNextRound: () => void
  onEndGame: () => void
}) {
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setNotes(round?.leader_notes ?? '')
  }, [round?.leader_notes])

  const groupedVotes = useMemo(() => {
    return teams.map((team) => ({
      team,
      voters: votes.filter((vote) => vote.team_id === team.id),
    }))
  }, [teams, votes])

  const totalParticipants = participants.length
  const pendingVotes = Math.max(totalParticipants - votes.length, 0)

  if (!round) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white/70 text-xl">
          Create a round to begin the live betting experience.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">
            Round {round.sequence + 1}
          </p>
          <h1 className="text-4xl font-bold mt-2">{phase.replace(/_/g, ' ').toUpperCase()}</h1>
          <p className="text-white/70 mt-2">
            {votes.length} / {totalParticipants} bets received
            {pendingVotes > 0 && phase === 'voting' && (
              <span className="ml-2 text-white/50">({pendingVotes} waiting)</span>
            )}
          </p>
          {round.leader_notes && (
            <p className="text-white mt-1">
              Participants: <span className="font-semibold">{round.leader_notes}</span>
            </p>
          )}
        </div>
        {phase === 'leader_selection' && (
          <button
            onClick={() => onOpenVoting(notes.trim())}
            className="bg-green-500 text-black font-semibold px-8 py-3 rounded-2xl hover:bg-green-400 transition"
            disabled={!notes.trim()}
          >
            Open voting
          </button>
        )}
        {phase === 'voting' && (
          <button
            onClick={onLockVoting}
            className="bg-yellow-400 text-black font-semibold px-8 py-3 rounded-2xl hover:bg-yellow-300 transition"
          >
            Lock betting
          </button>
        )}
      </header>

      {phase === 'leader_selection' && (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-white/50">Participants</p>
          <h2 className="text-2xl font-semibold mt-2">Who is competing?</h2>
          <textarea
            className="mt-4 w-full rounded-2xl bg-black/40 border border-white/10 p-4 text-lg"
            placeholder="John vs. Sarah"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          ></textarea>
          <p className="text-white/60 text-sm mt-2">
            This text is shown to all players before they bet.
          </p>
        </section>
      )}

      {phase === 'voting' && (
        <TransparencyPanel groupedVotes={groupedVotes} losingTeamId={null} />
      )}

      {phase === 'action' && (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 text-center">
          <p className="text-white/70 text-lg">
            Bets are locked. Trigger the losing team once the physical challenge is finished.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => onMarkLosingTeam(team.id)}
                style={{ backgroundColor: team.color_hex }}
                className="rounded-2xl text-white text-2xl font-semibold py-6 px-4 hover:opacity-90"
              >
                Mark {team.name} as loser
              </button>
            ))}
          </div>
        </section>
      )}

      {phase === 'resolution' && (
        <section className="space-y-6">
          <TransparencyPanel
            groupedVotes={groupedVotes}
            losingTeamId={round.losing_team_id}
          />
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={onNextRound}
              className="flex-1 bg-blue-500 rounded-2xl py-4 text-xl font-semibold hover:bg-blue-400"
            >
              Start next round
            </button>
            <button
              onClick={onEndGame}
              className="flex-1 bg-white/10 border border-white/20 rounded-2xl py-4 text-xl font-semibold"
            >
              End game & show results
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function TransparencyPanel({
  groupedVotes,
  losingTeamId,
}: {
  groupedVotes: { team: Team; voters: RoundVote[] }[]
  losingTeamId: string | null
}) {
  return (
    <section className="grid gap-4 grid-cols-1 md:grid-cols-2">
      {groupedVotes.map(({ team, voters }) => {
        const sortedVoters = [...voters].sort((a, b) =>
          a.participant.nickname.localeCompare(b.participant.nickname)
        )
        return (
          <div
            key={team.id}
            className="bg-white/5 border border-white/10 rounded-3xl p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">
                  {team.name}
                </p>
                <p className="text-4xl font-bold" style={{ color: team.color_hex }}>
                  {voters.length}
                </p>
              </div>
              {losingTeamId === team.id && (
                <span className="px-3 py-1 rounded-full bg-white/20 font-semibold">
                  Losing team
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2">
              {sortedVoters.length === 0 && (
                <p className="text-white/60 text-sm">No bets placed</p>
              )}
              {sortedVoters.map((vote) => (
                <div
                  key={vote.id}
                  className="bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-sm"
                >
                  {vote.participant.nickname}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
