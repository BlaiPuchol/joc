'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Game,
  GameChallenge,
  GameRound,
  GameTeam,
  Participant,
  RoundLineup,
  RoundOutcome,
  RoundVote,
  supabase,
} from '@/types/types'
import { TEAM_ORDER_LOOKUP } from '@/constants'
import Lobby from './lobby'
import Challenge from './quiz'
import Results from './results'

type LineupEntry = RoundLineup & { participant: Participant }

type GamePhase =
  | 'lobby'
  | 'leader_selection'
  | 'voting'
  | 'action'
  | 'resolution'
  | 'results'

const REFRESH_INTERVAL_MS = 4000

export default function Home({
  params: { id: gameId },
}: {
  params: { id: string }
}) {
  const [loading, setLoading] = useState(true)
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [teams, setTeams] = useState<GameTeam[]>([])
  const [roster, setRoster] = useState<Participant[]>([])
  const [lineups, setLineups] = useState<LineupEntry[]>([])
  const [challenges, setChallenges] = useState<GameChallenge[]>([])
  const [activeRound, setActiveRound] = useState<GameRound | null>(null)
  const [roundVotes, setRoundVotes] = useState<RoundVote[]>([])
  const [roundOutcomes, setRoundOutcomes] = useState<RoundOutcome[]>([])

  useEffect(() => {
    const checkSession = async () => {
      try {
        let userId: string | null = null
        const { data: sessionData } = await supabase.auth.getSession()
        
        if (sessionData.session) {
          userId = sessionData.session.user.id
        } else {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) throw error
          userId = data.user?.id ?? null
        }

        if (userId) {
          const { data: participantData } = await supabase
            .from('participants')
            .select()
            .eq('game_id', gameId)
            .eq('user_id', userId)
            .maybeSingle()
            
          if (participantData) {
            setParticipant(participantData)
          }
        }
      } catch (error) {
        console.error('Error checking session:', error)
      } finally {
        setLoading(false)
      }
    }
    
    checkSession()
  }, [gameId])

  const fetchVotes = useCallback(async (roundId: string) => {
    const { data, error } = await supabase
      .from('round_votes')
      .select('*, participant:participants(*), game_team:game_teams(*)')
      .eq('round_id', roundId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(error.message)
      return
    }

    setRoundVotes((data ?? []) as unknown as RoundVote[])
  }, [])

  const fetchLineups = useCallback(async (roundId: string) => {
    const { data, error } = await supabase
      .from('round_lineups')
      .select('*, participant:participants(*)')
      .eq('round_id', roundId)

    if (error) {
      console.error(error.message)
      return
    }

    setLineups((data ?? []) as unknown as LineupEntry[])
  }, [])

  const fetchOutcomes = useCallback(async (roundId: string) => {
    const { data, error } = await supabase
      .from('round_outcomes')
      .select('*')
      .eq('round_id', roundId)

    if (error) {
      console.error(error.message)
      return
    }

    setRoundOutcomes((data ?? []) as RoundOutcome[])
  }, [])

  const fetchRound = useCallback(
    async (roundId: string) => {
      const { data, error } = await supabase
        .from('game_rounds')
        .select('*')
        .eq('id', roundId)
        .single()

      if (error) {
        console.error(error.message)
        return
      }

      setActiveRound(data)
      fetchVotes(roundId)
      fetchLineups(roundId)
      fetchOutcomes(roundId)
    },
    [fetchLineups, fetchOutcomes, fetchVotes]
  )

  const refreshGameData = useCallback(async () => {
    const [
      { data: teamData, error: teamError },
      { data: gameData, error: gameError },
      { data: participantData, error: participantError },
      { data: challengeData, error: challengeError },
    ] = await Promise.all([
      supabase
        .from('game_teams')
        .select('*')
        .eq('game_id', gameId)
        .order('position', { ascending: true }),
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase
        .from('participants')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at'),
      supabase
        .from('game_challenges')
        .select('*')
        .eq('game_id', gameId)
        .order('position', { ascending: true }),
    ])

    if (teamError) {
      console.error(teamError.message)
    } else if (teamData) {
      setTeams(orderTeams(teamData))
    }

    if (gameError) {
      console.error(gameError.message)
    } else if (gameData) {
      setGame(gameData)
      if (gameData.active_round_id) {
        await fetchRound(gameData.active_round_id)
      } else {
        setActiveRound(null)
        setRoundVotes([])
        setLineups([])
        setRoundOutcomes([])
      }
    }

    if (participantError) {
      console.error(participantError.message)
    } else if (participantData) {
      setRoster(participantData)
    }

    if (challengeError) {
      console.error(challengeError.message)
    } else if (challengeData) {
      setChallenges(challengeData)
    }
  }, [fetchRound, gameId])

  useEffect(() => {
    refreshGameData()
  }, [refreshGameData])

  useEffect(() => {
    const interval = setInterval(() => {
      refreshGameData()
    }, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refreshGameData])

  useEffect(() => {
    const channel = supabase
      .channel(`game_participant_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updatedGame = payload.new as Game
          setGame(updatedGame)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  useEffect(() => {
    if (!participant?.id) return

    const channel = supabase
      .channel(`player_participant_${participant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'participants',
          filter: `id=eq.${participant.id}`,
        },
        (payload) => {
          const updatedParticipant = payload.new as Participant
          setParticipant((current) => (current?.id === updatedParticipant.id ? updatedParticipant : current))
          setRoster((current) => {
            const hasMember = current.some((member) => member.id === updatedParticipant.id)
            if (!hasMember) {
              return current
            }
            return current.map((member) =>
              member.id === updatedParticipant.id ? updatedParticipant : member
            )
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [participant?.id])

  useEffect(() => {
    const roundId = game?.active_round_id

    if (!roundId) {
      setActiveRound(null)
      setRoundVotes([])
      setLineups([])
      setRoundOutcomes([])
      return
    }

    fetchRound(roundId)

    const channel = supabase
      .channel(`round_${roundId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rounds',
          filter: `id=eq.${roundId}`,
        },
        (payload) => setActiveRound(payload.new as GameRound)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_votes',
          filter: `round_id=eq.${roundId}`,
        },
        () => fetchVotes(roundId)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_lineups',
          filter: `round_id=eq.${roundId}`,
        },
        () => fetchLineups(roundId)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_outcomes',
          filter: `round_id=eq.${roundId}`,
        },
        () => fetchOutcomes(roundId)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLineups, fetchOutcomes, fetchRound, fetchVotes, game?.active_round_id])


  const onRegisterCompleted = (newParticipant: Participant) => {
    setParticipant(newParticipant)
    if (!game) {
      return
    }
  }

  const castVote = async (teamId: string) => {
    if (!participant || !activeRound || game?.phase !== 'voting') return

    const { error } = await supabase
      .from('round_votes')
      .upsert(
        {
          round_id: activeRound.id,
          participant_id: participant.id,
          game_team_id: teamId,
        },
        { onConflict: 'round_id,participant_id' }
      )

    if (error) {
      console.error(error.message)
      alert(error.message)
      return
    }

    await fetchVotes(activeRound.id)
  }

  const playerVoteTeamId = useMemo(() => {
    if (!participant) return null
    return (
      roundVotes.find((vote) => vote.participant_id === participant.id)?.game_team_id ??
      null
    )
  }, [participant, roundVotes])

  const activeChallenge = useMemo(() => {
    if (!activeRound?.challenge_id) return null
    return challenges.find((challenge) => challenge.id === activeRound.challenge_id) ?? null
  }, [activeRound?.challenge_id, challenges])

  const toggleLineupParticipant = async (teamId: string, participantId: string, shouldAdd: boolean) => {
    if (!activeRound || game?.phase !== 'leader_selection') return
    if (shouldAdd) {
      const { error } = await supabase
        .from('round_lineups')
        .insert({ round_id: activeRound.id, team_id: teamId, participant_id: participantId })
      if (error && error.code !== '23505') {
        console.error(error.message)
        alert(error.message)
      }
      if (!error) {
        await fetchLineups(activeRound.id)
      }
      return
    }

    const { error } = await supabase
      .from('round_lineups')
      .delete()
      .match({ round_id: activeRound.id, team_id: teamId, participant_id: participantId })

    if (error) {
      console.error(error.message)
      alert(error.message)
      return
    }

    await fetchLineups(activeRound.id)
  }

  const updateNickname = async (newNickname: string) => {
    if (!participant) return
    const { error } = await supabase
      .from('participants')
      .update({ nickname: newNickname })
      .eq('id', participant.id)
    
    if (error) {
      console.error('Error updating nickname:', error.message)
      alert(error.message)
      return
    }
    console.log('Nickname updated successfully to:', newNickname)
    setParticipant({ ...participant, nickname: newNickname })
  }

  const currentPhase: GamePhase = (game?.phase as GamePhase) ?? 'lobby'

  if (loading) {
    return (
      <main className="bg-slate-900 min-h-screen flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white/60 animate-pulse">Carregant partida...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-slate-900 min-h-screen">
      {!participant && (
        <Lobby
          onRegisterCompleted={onRegisterCompleted}
          gameId={gameId}
        ></Lobby>
      )}

      {participant && currentPhase !== 'results' && (
        <Challenge
          phase={currentPhase}
          participant={participant}
          round={activeRound}
          teams={teams}
          votes={roundVotes}
          outcomes={roundOutcomes}
          onVote={castVote}
          playerVoteTeamId={playerVoteTeamId}
          roster={roster}
          lineups={lineups}
          challenge={activeChallenge}
          totalChallenges={challenges.length}
          onToggleLineup={toggleLineupParticipant}
          onUpdateNickname={updateNickname}
        />
      )}

      {participant && currentPhase === 'results' && (
        <Results participant={participant} gameId={gameId} />
      )}
    </main>
  )
}

const orderTeams = (teamList: GameTeam[]) =>
  [...teamList].sort((a, b) => {
    const positionDelta = (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER)
    if (positionDelta !== 0) {
      return positionDelta
    }

    const slugScore = (slug: string | null) => TEAM_ORDER_LOOKUP[slug ?? ''] ?? Number.MAX_SAFE_INTEGER
    return slugScore(a.slug) - slugScore(b.slug)
  })
