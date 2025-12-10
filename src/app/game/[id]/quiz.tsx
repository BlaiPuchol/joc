import { GameRound, Participant, RoundVote, Team } from '@/types/types'
import { useMemo } from 'react'

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
  playerVoteTeamId,
  onVote,
}: {
  phase: Phase
  participant: Participant
  round: GameRound | null
  teams: Team[]
  votes: RoundVote[]
  playerVoteTeamId: string | null
  onVote: (teamId: string) => void
}) {
  const losingTeamId = round?.losing_team_id ?? null

  const groupedVotes = useMemo(() => {
    return teams.map((team) => ({
      team,
      voters: votes.filter((vote) => vote.team_id === team.id),
    }))
  }, [teams, votes])

  const statusCopy: Record<Phase, string> = {
    lobby: 'Waiting for the host to begin the first challenge.',
    leader_selection: 'Waiting for leaders to choose who competes...',
    voting: 'Place your bet on the team you think will lose!',
    action: 'Challenge in progress... Good luck!',
    resolution: 'Results are in!',
    results: 'Game finished.',
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
                Your bet
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
        <p className="text-sm uppercase tracking-[0.3em] text-white/60">Live Challenge</p>
        <h1 className="text-3xl font-bold mt-2">Hey {participant.nickname}!</h1>
        <p className="mt-4 text-lg text-white/80">{statusCopy[phase]}</p>
        {round?.leader_notes && (
          <div className="mt-6 inline-block bg-white/10 border border-white/15 rounded-xl px-6 py-3 text-lg">
            Participants: <span className="font-semibold">{round.leader_notes}</span>
          </div>
        )}
      </div>

      {phase === 'voting' && renderVotingGrid()}

      {phase === 'leader_selection' && (
        <MessageBlock text="Waiting for leaders to choose players..." />
      )}

      {phase === 'lobby' && (
        <MessageBlock text="Sit tight while the host sets things up." />
      )}

      {phase === 'action' && (
        <MessageBlock text="Challenge in progress... bets are locked!" />
      )}

      {phase === 'resolution' && (
        <div className="flex-grow w-full px-4 pb-16">
          <div className="text-center mb-8">
            {losingTeamId && playerVoteTeamId === losingTeamId && (
              <p className="text-2xl font-semibold text-green-400">
                You guessed correctly! 🎉
              </p>
            )}
            {losingTeamId && playerVoteTeamId && playerVoteTeamId !== losingTeamId && (
              <p className="text-2xl font-semibold text-red-400">
                Not this time — better luck in the next round!
              </p>
            )}
            {!losingTeamId && (
              <p className="text-xl text-white/70">
                Waiting for the host to announce the losing team.
              </p>
            )}
          </div>
          <TransparencyPanel
            groupedVotes={groupedVotes}
            losingTeamId={losingTeamId}
          />
        </div>
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
                  {voters.length} vote{voters.length === 1 ? '' : 's'}
                </p>
              </div>
              {losingTeamId === team.id && (
                <span className="px-3 py-1 rounded-full text-sm bg-white/20 font-semibold">
                  Losing team
                </span>
              )}
            </div>
            <div className="mt-4 space-y-2 max-h-48 overflow-y-auto pr-2">
              {sortedVoters.length === 0 && (
                <p className="text-white/50 text-sm">No bets</p>
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

function MessageBlock({ text }: { text: string }) {
  return (
    <div className="flex-grow flex items-center justify-center px-4">
      <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-12 text-center text-xl text-white/80 max-w-xl">
        {text}
      </div>
    </div>
  )
}
