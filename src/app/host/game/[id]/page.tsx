'use client'

import {
  Game,
  GameRound,
  Participant,
  RoundVote,
  Team,
  supabase,
} from '@/types/types'
import { TEAM_ORDER_LOOKUP } from '@/constants'
import { useEffect, useState } from 'react'
import Lobby from './lobby'
import RoundController from './quiz'
import Results from './results'

type HostPhase =
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
  const [game, setGame] = useState<Game | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [activeRound, setActiveRound] = useState<GameRound | null>(null)
  const [votes, setVotes] = useState<RoundVote[]>([])

  useEffect(() => {
    const fetchInitial = async () => {
      const [{ data: gameData }, { data: participantData }, { data: teamData }] =
        await Promise.all([
          supabase.from('games').select('*').eq('id', gameId).single(),
          supabase
            .from('participants')
            .select('*')
            .eq('game_id', gameId)
            .order('created_at'),
          supabase.from('teams').select('*').order('slug'),
        ])

      if (gameData) {
        setGame(gameData)
        if (gameData.active_round_id) {
          fetchRound(gameData.active_round_id)
        }
      }
      if (participantData) {
        setParticipants(participantData)
      }
      if (teamData) {
        setTeams(orderTeams(teamData))
      }
    }

    fetchInitial()
  }, [gameId])

  useEffect(() => {
    const channel = supabase
      .channel(`host_game_${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'participants',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          setParticipants((prev) => [...prev, payload.new as Participant])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const updated = payload.new as Game
          setGame(updated)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  useEffect(() => {
    if (!game?.active_round_id) {
      setActiveRound(null)
      setVotes([])
      return
    }

    fetchRound(game.active_round_id)

    const channel = supabase
      .channel(`host_round_${game.active_round_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_rounds',
          filter: `id=eq.${game.active_round_id}`,
        },
        (payload) => setActiveRound(payload.new as GameRound)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_votes',
          filter: `round_id=eq.${game.active_round_id}`,
        },
        () => fetchVotes(game.active_round_id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [game?.active_round_id])

  const fetchRound = async (roundId: string) => {
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
  }

  const fetchVotes = async (roundId: string) => {
    const { data, error } = await supabase
      .from('round_votes')
      .select('*, participant:participants(*), team:teams(*)')
      .eq('round_id', roundId)
      .order('created_at', { ascending: true })
    if (error) {
      console.error(error.message)
      return
    }
    setVotes((data ?? []) as unknown as RoundVote[])
  }

  const createAndActivateRound = async (sequence: number) => {
    const { data, error } = await supabase
      .from('game_rounds')
      .insert({ game_id: gameId, sequence })
      .select()
      .single()
    if (error) {
      alert(error.message)
      return null
    }

    const { error: gameError } = await supabase
      .from('games')
      .update({
        active_round_id: data.id,
        current_round_sequence: sequence,
        phase: 'leader_selection',
      })
      .eq('id', gameId)

    if (gameError) {
      alert(gameError.message)
      return null
    }

    return data
  }

  const handleStartRound = async () => {
    if (!game) return
    if (game.active_round_id) {
      await supabase.from('games').update({ phase: 'leader_selection' }).eq('id', gameId)
      return
    }
    await createAndActivateRound(game.current_round_sequence ?? 0)
  }

  const openVoting = async (notes: string) => {
    if (!game?.active_round_id) return
    const { error } = await supabase
      .from('game_rounds')
      .update({ leader_notes: notes, state: 'voting' })
      .eq('id', game.active_round_id)
    if (error) {
      alert(error.message)
      return
    }
    await supabase.from('games').update({ phase: 'voting' }).eq('id', gameId)
  }

  const lockVoting = async () => {
    if (!game?.active_round_id) return
    const { error } = await supabase
      .from('game_rounds')
      .update({ state: 'action' })
      .eq('id', game.active_round_id)
    if (error) {
      alert(error.message)
      return
    }
    await supabase.from('games').update({ phase: 'action' }).eq('id', gameId)
  }

  const markLosingTeam = async (teamId: string) => {
    if (!game?.active_round_id) return
    const { error } = await supabase
      .from('game_rounds')
      .update({ losing_team_id: teamId, state: 'resolution' })
      .eq('id', game.active_round_id)
    if (error) {
      alert(error.message)
      return
    }
    await supabase.from('games').update({ phase: 'resolution' }).eq('id', gameId)
  }

  const nextRound = async () => {
    if (!game) return
    await createAndActivateRound((game.current_round_sequence ?? 0) + 1)
  }

  const endGame = async () => {
    await supabase.from('games').update({ phase: 'results' }).eq('id', gameId)
  }

  const phase: HostPhase = (game?.phase as HostPhase) ?? 'lobby'

  return (
    <main className="bg-slate-900 min-h-screen text-white">
      {phase === 'lobby' && (
        <Lobby
          participants={participants}
          onStart={handleStartRound}
          gameId={gameId}
        />
      )}

      {phase !== 'lobby' && phase !== 'results' && (
        <RoundController
          phase={phase}
          round={activeRound}
          participants={participants}
          teams={teams}
          votes={votes}
          onOpenVoting={openVoting}
          onLockVoting={lockVoting}
          onMarkLosingTeam={markLosingTeam}
          onNextRound={nextRound}
          onEndGame={endGame}
        />
      )}

      {phase === 'results' && <Results gameId={gameId} />}
    </main>
  )
}

const orderTeams = (teamList: Team[]) =>
  [...teamList].sort(
    (a, b) =>
      (TEAM_ORDER_LOOKUP[a.slug] ?? Number.MAX_SAFE_INTEGER) -
      (TEAM_ORDER_LOOKUP[b.slug] ?? Number.MAX_SAFE_INTEGER)
  )
