'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Game,
  GameRound,
  GameTeam,
  Participant,
  RoundVote,
  supabase,
} from '@/types/types'
import { TEAM_ORDER_LOOKUP } from '@/constants'
import Lobby from './lobby'
import Challenge from './quiz'
import Results from './results'

type GamePhase =
  | 'lobby'
  | 'leader_selection'
  | 'voting'
  | 'action'
  | 'resolution'
  | 'results'

export default function Home({
  params: { id: gameId },
}: {
  params: { id: string }
}) {
  const [participant, setParticipant] = useState<Participant | null>(null)
  const [game, setGame] = useState<Game | null>(null)
  const [teams, setTeams] = useState<GameTeam[]>([])
  const [activeRound, setActiveRound] = useState<GameRound | null>(null)
  const [roundVotes, setRoundVotes] = useState<RoundVote[]>([])

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
    },
    [fetchVotes]
  )

  useEffect(() => {
    const fetchInitialData = async () => {
      const [{ data: teamData }, { data: gameData }] = await Promise.all([
        supabase
          .from('game_teams')
          .select('*')
          .eq('game_id', gameId)
          .order('position', { ascending: true }),
        supabase.from('games').select('*').eq('id', gameId).single(),
      ])

      if (teamData) {
        setTeams(orderTeams(teamData))
      }

      if (gameData) {
        setGame(gameData)
        if (gameData.active_round_id) {
          fetchRound(gameData.active_round_id)
        }
      }
    }

    fetchInitialData()
  }, [gameId, fetchRound])

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
    const roundId = game?.active_round_id

    if (!roundId) {
      setActiveRound(null)
      setRoundVotes([])
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
}, [game?.active_round_id, fetchRound, fetchVotes])


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

  const currentPhase: GamePhase = (game?.phase as GamePhase) ?? 'lobby'

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
          onVote={castVote}
          playerVoteTeamId={playerVoteTeamId}
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
