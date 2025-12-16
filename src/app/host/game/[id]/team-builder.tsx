import { GameTeam, Participant } from '@/types/types'

export default function TeamBuilder({
  teams,
  participants,
  onAssign,
  onSetLeader,
  onBegin,
}: {
  teams: GameTeam[]
  participants: Participant[]
  onAssign: (participantId: string, teamId: string | null) => void
  onSetLeader: (teamId: string, participantId: string | null) => void
  onBegin: () => void
}) {
  const activeTeams = teams.filter((team) => team.is_active)
  const unassigned = participants.filter((participant) => !participant.game_team_id)

  const assignedCountByTeam = (teamId: string) =>
    participants.filter((participant) => participant.game_team_id === teamId)

  const ready =
    activeTeams.length >= 2 &&
    activeTeams.every((team) => assignedCountByTeam(team.id).length > 0 && team.leader_participant_id)

  return (
    <section className="min-h-screen bg-slate-900 text-white px-6 py-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-white/40">Team builder</p>
          <h1 className="text-4xl font-semibold">Drop players into their squads</h1>
          <p className="text-white/70 max-w-2xl">
            Assign everyone to a team and pick a leader for each squad. Leaders will be the ones picking who competes on
            every physical challenge, so make sure they know the rules.
          </p>
        </header>

        <div className="bg-black/40 border border-white/10 rounded-3xl p-5">
          <h2 className="text-xl font-semibold mb-3">Players waiting ({unassigned.length})</h2>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-full px-4 py-2"
              >
                <span>{participant.nickname}</span>
                <select
                  className="bg-black/40 border border-white/10 rounded-full px-2 py-1 text-sm"
                  defaultValue=""
                  onChange={(event) => {
                    if (!event.target.value) return
                    onAssign(participant.id, event.target.value)
                    event.target.value = ''
                  }}
                >
                  <option value="">Assign…</option>
                  {activeTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {unassigned.length === 0 && (
              <p className="text-white/60">Everyone has been assigned 🎉</p>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {activeTeams.map((team) => {
            const members = assignedCountByTeam(team.id)
            return (
              <article
                key={team.id}
                className="bg-black/40 border border-white/10 rounded-3xl p-5 space-y-4"
                style={{ boxShadow: `0 0 30px ${team.color_hex}22` }}
              >
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-white/40">Team</p>
                    <h3 className="text-2xl font-semibold" style={{ color: team.color_hex }}>
                      {team.name}
                    </h3>
                  </div>
                  <span className="text-white/60 text-sm">{members.length} players</span>
                </header>
                <div className="space-y-2">
                  {members.map((member) => {
                    const isLeader = team.leader_participant_id === member.id
                    return (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 bg-white/5 rounded-2xl px-4 py-2"
                      >
                        <span className="font-medium">{member.nickname}</span>
                        {isLeader && (
                          <span className="text-xs uppercase tracking-[0.3em] text-emerald-300">Leader</span>
                        )}
                        <div className="ml-auto flex gap-2 text-sm">
                          {!isLeader && (
                            <button
                              onClick={() => onSetLeader(team.id, member.id)}
                              className="px-3 py-1 rounded-full border border-white/20"
                            >
                              Lead
                            </button>
                          )}
                          <button
                            onClick={() => onAssign(member.id, null)}
                            className="px-3 py-1 rounded-full border border-white/20 text-white/70"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {members.length === 0 && (
                    <div className="text-white/50 text-sm bg-white/5 rounded-2xl px-4 py-3">
                      Assign players here to fill the roster.
                    </div>
                  )}
                </div>
                {members.length > 0 && !team.leader_participant_id && (
                  <p className="text-sm text-amber-300">Assign a leader to continue.</p>
                )}
              </article>
            )
          })}
        </div>

        <footer className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <button
            onClick={onBegin}
            disabled={!ready}
            className="flex-1 bg-emerald-400 text-black font-semibold rounded-2xl py-4 text-lg disabled:opacity-50"
          >
            Lock teams & start first challenge
          </button>
          {!ready && (
            <p className="text-white/60 text-sm">
              Every active team needs at least one player and a leader before starting.
            </p>
          )}
        </footer>
      </div>
    </section>
  )
}
