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
          <p className="text-sm uppercase tracking-[0.3em] text-white/40">Organitzador d&apos;equips</p>
          <h1 className="text-4xl font-semibold">Distribuïx els jugadors als seus equips</h1>
          <p className="text-white/70 max-w-2xl">
            Assigna tothom a un equip i tria un líder per a cada grup. Les persones líders decidiran qui competix en
            cada repte físic, així que assegura&apos;t que coneixen les regles.
          </p>
        </header>

        <div className="bg-black/40 border border-white/10 rounded-3xl p-5">
          <h2 className="text-xl font-semibold mb-3">Jugadors en espera ({unassigned.length})</h2>
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
                  <option value="">Assignar…</option>
                  {activeTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {unassigned.length === 0 && (
              <p className="text-white/60">Tothom ja té equip 🎉</p>
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
                    <p className="text-sm uppercase tracking-[0.3em] text-white/40">Equip</p>
                    <h3 className="text-2xl font-semibold" style={{ color: team.color_hex }}>
                      {team.name}
                    </h3>
                  </div>
                  <span className="text-white/60 text-sm">{members.length} jugadors</span>
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
                          <span className="text-xs uppercase tracking-[0.3em] text-emerald-300">Líder</span>
                        )}
                        <div className="ml-auto flex gap-2 text-sm">
                          {!isLeader && (
                            <button
                              onClick={() => onSetLeader(team.id, member.id)}
                              className="px-3 py-1 rounded-full border border-white/20"
                            >
                              Liderar
                            </button>
                          )}
                          <button
                            onClick={() => onAssign(member.id, null)}
                            className="px-3 py-1 rounded-full border border-white/20 text-white/70"
                          >
                            Traure
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {members.length === 0 && (
                    <div className="text-white/50 text-sm bg-white/5 rounded-2xl px-4 py-3">
                      Assigna jugadors ací per a completar la plantilla.
                    </div>
                  )}
                </div>
                {members.length > 0 && !team.leader_participant_id && (
                  <p className="text-sm text-amber-300">Assigna una persona líder per a continuar.</p>
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
            Tanca equips i comença el primer repte
          </button>
          {!ready && (
            <p className="text-white/60 text-sm">
              Cada equip actiu necessita almenys un jugador i una persona líder abans de començar.
            </p>
          )}
        </footer>
      </div>
    </section>
  )
}
