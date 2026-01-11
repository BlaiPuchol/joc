import { TeamLeaderboard } from '@/components/team-leaderboard'
import { FormattedText } from '@/components/formatted-text'
import { useTeamScores } from '@/hooks/useTeamScores'
import { GameChallenge, GameRound, GameTeam, Participant, RoundLineup, RoundOutcome, RoundVote, supabase } from '@/types/types'
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
  totalChallenges,
  onVote,
  onToggleLineup,
  onUpdateNickname,
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
  totalChallenges: number
  onVote: (teamId: string) => void
  onToggleLineup: (teamId: string, participantId: string, shouldAdd: boolean) => void
  onUpdateNickname: (newNickname: string) => void
}) {
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [showTeams, setShowTeams] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [newName, setNewName] = useState(participant.nickname)
  const [history, setHistory] = useState<{ round: GameRound; challenge: GameChallenge | null; outcomes: RoundOutcome[] }[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const { scores, loading: scoresLoading, reload: reloadScores } = useTeamScores(round?.game_id ?? null)

  useEffect(() => {
    if (showLeaderboard) {
      reloadScores()
    }
  }, [showLeaderboard, reloadScores])

  useEffect(() => {
    if (showHistory && round?.game_id) {
      const loadHistory = async () => {
        setHistoryLoading(true)
        const { data: roundsData } = await supabase
          .from('game_rounds')
          .select('*, game_challenges(*)')
          .eq('game_id', round.game_id)
          .lt('sequence', round.sequence)
          .order('sequence', { ascending: false })

        if (roundsData) {
          const roundIds = roundsData.map(r => r.id)
          const { data: outcomesData } = await supabase
            .from('round_outcomes')
            .select('*')
            .in('round_id', roundIds)

          const combined = roundsData.map(r => ({
            round: r,
            challenge: r.game_challenges as unknown as GameChallenge | null,
            outcomes: (outcomesData ?? []).filter(o => o.round_id === r.id)
          }))
          setHistory(combined)
        }
        setHistoryLoading(false)
      }
      loadHistory()
    }
  }, [showHistory, round?.game_id, round?.sequence])

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
    <section className="space-y-4">
      <header className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Quin equip perdrà?</h2>
        <p className="text-sm text-white/70">
          Toca una targeta per a apostar.
        </p>
      </header>
      <div className="grid grid-cols-1 gap-4">
        {teams.map((team) => {
          const isSelected = playerVoteTeamId === team.id
          return (
            <button
              key={team.id}
              onClick={() => onVote(team.id)}
              disabled={phase !== 'voting'}
              className={`relative overflow-hidden text-center text-white px-6 py-8 rounded-2xl transition-all
                ${phase !== 'voting' ? 'opacity-60' : 'active:scale-[0.98]'}
              `}
              style={{
                background: `linear-gradient(145deg, ${hexToRgba(team.color_hex, 0.8)}, ${hexToRgba(team.color_hex, 0.5)})`,
                boxShadow: isSelected ? `0 0 0 4px white` : `0 10px 20px -5px ${hexToRgba(team.color_hex, 0.5)}`,
                transform: isSelected ? 'scale(1.02)' : undefined
              }}
            >
              <div className="flex flex-col items-center justify-center gap-3 relative z-10">
                <span className="text-3xl font-black tracking-tight">{team.name}</span>
                {isSelected && (
                  <span className="bg-white text-black text-sm font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                    La teua aposta
                  </span>
                )}
              </div>
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
            </button>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="min-h-screen pb-20" style={{ background: screenBackground }}>
      {/* Top Bar */}
      <header 
        className="sticky top-0 z-30 shadow-xl backdrop-blur-md border-b border-white/10 transition-all duration-500"
        style={{ 
          background: playerTeam 
            ? `linear-gradient(135deg, ${hexToRgba(playerTeam.color_hex, 0.5)}, rgba(2, 6, 23, 0.95))` 
            : '#0f172a' 
        }}
      >
        <div className="px-5 py-4 flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90 mb-1">{participant.nickname}</span>
              {playerTeam && (
                <h1 className="text-4xl font-black leading-none tracking-tight text-white drop-shadow-md">
                  {playerTeam.name}
                </h1>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowTeams(true)}
                className="p-3 bg-black/20 rounded-full hover:bg-black/30 text-white transition-colors backdrop-blur-sm"
                aria-label="Veure equips"
              >
                👥
              </button>
              <button 
                onClick={() => setShowHistory(true)}
                className="p-3 bg-black/20 rounded-full hover:bg-black/30 text-white transition-colors backdrop-blur-sm"
                aria-label="Veure historial"
              >
                📜
              </button>
              <button 
                onClick={() => setShowLeaderboard(true)}
                className="p-3 bg-black/20 rounded-full hover:bg-black/30 text-white transition-colors backdrop-blur-sm"
                aria-label="Veure classificació"
              >
                🏆
              </button>
            </div>
          </div>
          
          {round && (
            <div className="flex items-center justify-between border-t border-white/20 pt-3">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                Repte {round.sequence + 1} / {totalChallenges}
              </span>
            </div>
          )}
        </div>
      </header>

      <main className="p-4 flex flex-col gap-6 text-white">
        {/* Phase: Lobby */}
        {phase === 'lobby' && (
          <div className="text-center py-10 space-y-6">
            <div className="text-4xl animate-pulse">⏳</div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold">Preparant la partida...</h2>
              <p className="text-white/60">Estigues atent a la pantalla principal.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-xs mx-auto">
              {isEditingName ? (
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-black/30 border border-white/20 rounded px-3 py-2 text-center text-white focus:outline-none focus:border-emerald-400"
                    placeholder="El teu nom"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => {
                        if (newName.trim()) {
                          onUpdateNickname(newName.trim())
                          setIsEditingName(false)
                        }
                      }}
                      className="bg-emerald-500/20 text-emerald-300 px-4 py-1 rounded text-sm font-medium hover:bg-emerald-500/30"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => {
                        setNewName(participant.nickname)
                        setIsEditingName(false)
                      }}
                      className="bg-white/10 text-white/70 px-4 py-1 rounded text-sm font-medium hover:bg-white/20"
                    >
                      Cancel·lar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-white/50 uppercase tracking-wider">Jugant com a</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl font-bold">{participant.nickname}</span>
                    <button
                      onClick={() => {
                        setNewName(participant.nickname)
                        setIsEditingName(true)
                      }}
                      className="p-1 text-white/40 hover:text-white transition-colors"
                      aria-label="Editar nom"
                    >
                      ✏️
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase: Leader Selection */}
        {phase === 'leader_selection' && playerTeam && (
          <div className="space-y-6">
            {isLeader ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/20 border border-emerald-500/40 p-4 rounded-xl text-center">
                  <p className="text-emerald-200 font-bold text-lg">👑 Eres líder!</p>
                  <p className="text-sm text-emerald-100/80">Tria qui jugarà aquesta ronda.</p>
                </div>
                <LeaderLineupSelector
                  team={playerTeam}
                  members={playerTeamMembers}
                  selected={new Set(playerSelection.map((player) => player.id))}
                  requiredCount={requiredCount}
                  onToggle={(playerId, shouldAdd) => onToggleLineup(playerTeam.id, playerId, shouldAdd)}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 p-6 rounded-xl text-center space-y-3">
                  <p className="text-sm uppercase tracking-widest text-white/50">El teu equip</p>
                  <h2 className="text-3xl font-bold" style={{ color: playerTeam.color_hex }}>{playerTeam.name}</h2>
                  <div className="pt-4 border-t border-white/10 mt-4">
                    <p className="text-sm text-white/70 mb-1">Líder actual</p>
                    <p className="text-lg font-semibold">
                      {playerTeamMembers.find(m => m.id === playerTeam.leader_participant_id)?.nickname ?? 'Assignant...'}
                    </p>
                  </div>
                  <div className="pt-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs uppercase tracking-wider ${
                      isTeamReady(playerTeam) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {isTeamReady(playerTeam) ? 'Alineació llesta' : 'Triant jugadors...'}
                    </span>
                  </div>
                </div>
                {playerSelection.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-lg uppercase tracking-widest text-white/50 px-1">Convocats</p>
                    {playerSelection.map(p => (
                      <div key={p.id} className="bg-white/10 px-4 py-3 text-lg rounded-lg flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        {p.nickname}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Phase: Voting */}
        {phase === 'voting' && renderVotingGrid()}

        {/* Phase: Action */}
        {phase === 'action' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-900/50 to-slate-900/50 border border-white/10 p-6 rounded-2xl space-y-4 text-center">
              <span className="inline-block px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs uppercase tracking-wider">
                Repte en curs
              </span>
              <h1 className="text-3xl font-black leading-tight">
                {challenge?.title ?? 'Repte sorpresa'}
              </h1>
              {challenge?.description && (
                <p className="text-white/80 text-lg leading-relaxed">
                  {challenge.description}
                </p>
              )}
            </div>
            <div className="text-center text-white/50 text-lg">
              {lineups.some(l => l.participant_id === participant.id)
                ? 'Has de participar! Bona sort en el repte!'
                : 'Descansa en aquest repte i anima als teus companys!'}
            </div>
            
            {challenge?.rules && (
              <div className="bg-slate-900/50 rounded-xl p-5 border border-white/10 text-left">
                <p className="text-xs uppercase tracking-[0.25em] text-white/40 mb-3 font-semibold">Regles</p>
                <FormattedText text={challenge.rules} className="text-white/80" />
              </div>
            )}
          </div>
        )}

        {/* Phase: Resolution */}
        {phase === 'resolution' && (
          <div className="space-y-6">
            <div className="text-center space-y-3 py-6">
              {playerGuessedCorrectly && (
                <div className="bg-emerald-500/20 border border-emerald-500/40 p-6 rounded-2xl">
                  <p className="text-4xl mb-2">🎉</p>
                  <p className="text-2xl font-bold text-emerald-300">Has encertat!</p>
                  <p className="text-emerald-100/80">+3 punts per al teu equip</p>
                </div>
              )}
              {hasRoundResults && playerVoteTeamId && !playerGuessedCorrectly && (
                <div className="bg-rose-500/20 border border-rose-500/40 p-6 rounded-2xl">
                  <p className="text-4xl mb-2">🥃</p>
                  <p className="text-2xl font-bold text-rose-300">Has de beure!</p>
                  <p className="text-rose-100/80">No has encertat l&apos;equip perdedor.</p>
                </div>
              )}
              {!hasRoundResults && (
                <div className="animate-pulse text-xl text-white/80">
                  Esperant resultats...
                </div>
              )}
            </div>
            <TransparencyPanel groupedVotes={groupedVotes} losingTeamIds={losingTeamIds} />
          </div>
        )}
      </main>

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur flex flex-col">
          <header className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-bold uppercase tracking-widest">Classificació</h2>
            <button 
              onClick={() => setShowLeaderboard(false)}
              className="p-2 bg-white/10 rounded-full hover:bg-white/20"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">
            {scoresLoading ? (
              <p className="text-center text-white/50 py-10">Carregant...</p>
            ) : (
              <TeamLeaderboard scores={scores} highlightTeamId={participant.game_team_id} highlightLabel="El teu equip" />
            )}
          </div>
        </div>
      )}

      {/* Teams Modal */}
      {showTeams && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur flex flex-col">
          <header className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-bold uppercase tracking-widest">Equips</h2>
            <button 
              onClick={() => setShowTeams(false)}
              className="p-2 bg-white/10 rounded-full hover:bg-white/20"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {teams.map(team => (
              <div key={team.id} className="space-y-2">
                <h3 className="text-3xl font-bold" style={{ color: team.color_hex }}>{team.name}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {membersByTeam[team.id]?.map(member => (
                    <div key={member.id} className="bg-white/5 p-2 rounded text-lg">
                      {member.nickname}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur flex flex-col">
          <header className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-bold uppercase tracking-widest">Historial</h2>
            <button 
              onClick={() => setShowHistory(false)}
              className="p-2 bg-white/10 rounded-full hover:bg-white/20"
            >
              ✕
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {historyLoading ? (
              <p className="text-center text-white/50 py-10">Carregant...</p>
            ) : history.length === 0 ? (
              <p className="text-center text-white/50 py-10">Encara no hi ha historial.</p>
            ) : (
              history.map((item) => (
                <div key={item.round.id} className="bg-white/5 rounded-xl p-4 space-y-3 border border-white/10">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-white/50">Repte {item.round.sequence + 1}</span>
                      <h3 className="font-bold text-lg">{item.challenge?.title ?? 'Repte desconegut'}</h3>
                    </div>
                  </div>
                  
                  {item.outcomes.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wider text-white/50">Resultats</p>
                      {item.outcomes.map(outcome => {
                        const team = teams.find(t => t.id === outcome.team_id)
                        if (!team) return null
                        return (
                          <div key={outcome.id} className="flex items-center justify-between bg-black/20 p-2 rounded">
                            <span style={{ color: team.color_hex }} className="font-medium">{team.name}</span>
                            <div className="flex items-center gap-2">
                              {outcome.is_loser && <span className="text-xs bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded">Perdedor</span>}
                              <span className="font-mono font-bold">+{outcome.challenge_points} pts</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-white/50 italic">Sense resultats registrats.</p>
                  )}
                </div>
              ))
            )}
          </div>
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
  const totalVotes = groupedVotes.reduce((sum, entry) => sum + entry.voters.length, 0) || 1
  return (
    <div className="space-y-4">
      {groupedVotes.map(({ team, voters }) => {
        const sortedVoters = [...voters].sort((a, b) =>
          a.participant.nickname.localeCompare(b.participant.nickname)
        )
        const isLoser = losingTeamIds.has(team.id)
        return (
          <article
            key={team.id}
            className="relative overflow-hidden rounded-xl p-4 border border-white/10"
            style={{
              background: `linear-gradient(140deg, ${hexToRgba(team.color_hex, 0.2)}, rgba(2, 6, 23, 0.95))`,
            }}
          >
            <div className="relative z-10 space-y-3">
              <header className="flex items-center justify-between">
                <div>
                  <p className="text-base uppercase tracking-wider text-white/70">{team.name}</p>
                  <p className="text-3xl font-bold">
                    {voters.length} {voters.length === 1 ? 'vot' : 'vots'}
                  </p>
                </div>
                {isLoser && (
                  <span className="px-3 py-1 rounded-full text-base uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    Perdedor
                  </span>
                )}
              </header>
              <div className="bg-white/10 rounded-full h-4" role="meter" aria-valuenow={voters.length}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round((voters.length / totalVotes) * 100)}%`,
                    backgroundColor: team.color_hex,
                  }}
                ></div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                {sortedVoters.length === 0 && (
                  <p className="text-white/50 text-xs">Sense apostes.</p>
                )}
                {sortedVoters.map((vote) => (
                  <div key={vote.id} className="bg-white/10 rounded-lg px-2 py-1 text-lg">
                    {vote.participant.nickname}
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
  const remaining = maxSelectable - selected.size

  return (
    <article className="space-y-4">
      <header className="flex items-center justify-between text-base">
        <span className="text-white/60">Selecciona {maxSelectable} jugadors</span>
        <span className={`${remaining === 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
          {remaining === 0 ? 'Complet' : `Falten ${remaining}`}
        </span>
      </header>
      
      <div className="grid grid-cols-1 gap-2">
        {members.length === 0 && (
          <p className="text-white/50 text-center py-4 text-lg">No hi ha membres disponibles.</p>
        )}
        {members.map((member) => {
          const isPlaying = selected.has(member.id)
          const disableAdd = !isPlaying && maxSelectable !== 0 && selected.size >= maxSelectable
          return (
            <button
              key={member.id}
              onClick={() => onToggle(member.id, !isPlaying)}
              disabled={disableAdd}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                isPlaying
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-100'
                  : 'bg-white/5 border border-white/10 text-white/70'
              } ${disableAdd ? 'opacity-50' : 'active:scale-[0.98]'}`}
            >
              <span className="text-lg">{member.nickname}</span>
              <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                isPlaying ? 'border-emerald-400 bg-emerald-400' : 'border-white/30'
              }`}>
                {isPlaying && <span className="text-black text-xs">✓</span>}
              </div>
            </button>
          )
        })}
      </div>
    </article>
  )
}

function MessageBlock({ text }: { text: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center text-lg font-medium text-white/80">
      {text}
    </div>
  )
}
