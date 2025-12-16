'use client'

import {
  Game,
  GameChallenge,
  GameRound,
  GameTeam,
  Participant,
  RoundLineup,
  RoundVote,
  supabase,
} from '@/types/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Lobby from './lobby'
import TeamBuilder from './team-builder'
import RoundController from './quiz'
import Results from './results'

type HostPhase =
  | 'lobby'
  | 'team_setup'
  | 'leader_selection'
  | 'voting'
  | 'action'
  | 'resolution'
  | 'results'

type LineupEntry = RoundLineup & { participant: Participant }

export default function HostGame({
  params: { id: gameId },
}: {
  params: { id: string }
}) {
  const [game, setGame] = useState<Game | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [teams, setTeams] = useState<GameTeam[]>([])
  const [challenges, setChallenges] = useState<GameChallenge[]>([])
  const [activeRound, setActiveRound] = useState<GameRound | null>(null)
  const [votes, setVotes] = useState<RoundVote[]>([])
  const [lineups, setLineups] = useState<LineupEntry[]>([])

  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => a.position - b.position),
    [teams]
  )
  const sortedChallenges = useMemo(
    () => [...challenges].sort((a, b) => a.position - b.position),
    [challenges]
  )

  const activeChallenge = useMemo(() => {
    if (!activeRound?.challenge_id) return null
    return sortedChallenges.find((challenge) => challenge.id === activeRound.challenge_id) ?? null
  }, [activeRound?.challenge_id, sortedChallenges])

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
    setVotes((data ?? []) as unknown as RoundVote[])
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
    },
    [fetchLineups, fetchVotes]
  )

  useEffect(() => {
    const fetchInitial = async () => {
      const [gameRes, participantRes, teamRes, challengeRes] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('participants').select('*').eq('game_id', gameId).order('created_at'),
        supabase
          .from('game_teams')
          .select('*')
          .eq('game_id', gameId)
          .order('position', { ascending: true }),
        supabase
          .from('game_challenges')
          .select('*')
          .eq('game_id', gameId)
          .order('position', { ascending: true }),
      ])

      if (gameRes.data) {
        setGame(gameRes.data)
        if (gameRes.data.active_round_id) {
          fetchRound(gameRes.data.active_round_id)
        }
      }
      if (participantRes.data) {
        setParticipants(participantRes.data)
      }
      if (teamRes.data) {
        setTeams(teamRes.data)
      }
      if (challengeRes.data) {
        setChallenges(challengeRes.data)
      }
    }

    fetchInitial()
  }, [fetchRound, gameId])

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
          table: 'participants',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          setParticipants((prev) =>
            prev.map((participant) =>
              participant.id === payload.new.id ? (payload.new as Participant) : participant
            )
          )
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
        (payload) => setGame(payload.new as Game)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_teams',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          setTeams((prev) => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new as GameTeam].sort((a, b) => a.position - b.position)
            }
            if (payload.eventType === 'UPDATE') {
              return prev
                .map((team) => (team.id === payload.new.id ? (payload.new as GameTeam) : team))
                .sort((a, b) => a.position - b.position)
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter((team) => team.id !== payload.old.id)
            }
            return prev
          })
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
      setVotes([])
      setLineups([])
      return
    }

    fetchRound(roundId)

    const channel = supabase
      .channel(`host_round_${roundId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_rounds', filter: `id=eq.${roundId}` },
        (payload) => setActiveRound(payload.new as GameRound)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_votes', filter: `round_id=eq.${roundId}` },
        () => fetchVotes(roundId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'round_lineups', filter: `round_id=eq.${roundId}` },
        () => fetchLineups(roundId)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLineups, fetchRound, fetchVotes, game?.active_round_id])

  const getChallengeForSequence = useCallback(
    (sequence: number) => {
      if (sortedChallenges.length === 0) return null
      return sortedChallenges[Math.max(sequence, 0) % sortedChallenges.length]
    },
    [sortedChallenges]
  )

  const createAndActivateRound = async (sequence: number) => {
    const challenge = getChallengeForSequence(sequence)
    if (!challenge) {
      alert('Add at least one challenge before starting.')
      return null
    }
    const { data, error } = await supabase
      .from('game_rounds')
      .insert({ game_id: gameId, sequence, challenge_id: challenge.id })
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

  const handleOpenTeamSetup = async () => {
    await supabase.from('games').update({ phase: 'team_setup' }).eq('id', gameId)
  }

  const handleStartChallenge = async () => {
    if (!game) return
    if (game.active_round_id) {
      await supabase.from('games').update({ phase: 'leader_selection' }).eq('id', gameId)
      return
    }
    await createAndActivateRound(game.current_round_sequence ?? 0)
  }

  const assignParticipant = async (participantId: string, teamId: string | null) => {
    const { error } = await supabase
      .from('participants')
      .update({ game_team_id: teamId })
      .eq('id', participantId)
    if (error) alert(error.message)
  }

  const setTeamLeader = async (teamId: string, participantId: string | null) => {
    const { error } = await supabase
      .from('game_teams')
      .update({ leader_participant_id: participantId })
      .eq('id', teamId)
    if (error) alert(error.message)
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

  const toggleLineupParticipant = async (teamId: string, participantId: string, shouldAdd: boolean) => {
    if (!game?.active_round_id) return
    if (shouldAdd) {
      const { error } = await supabase
        .from('round_lineups')
        .insert({ round_id: game.active_round_id, team_id: teamId, participant_id: participantId })
      if (error && error.code !== '23505') {
        alert(error.message)
      }
      return
    }
    const { error } = await supabase
      .from('round_lineups')
      .delete()
      .match({ round_id: game.active_round_id, team_id: teamId, participant_id: participantId })
    if (error) alert(error.message)
  }

  const phase: HostPhase = (game?.phase as HostPhase) ?? 'lobby'

  return (
    <main className="bg-slate-900 min-h-screen text-white">
      {phase === 'lobby' && (
        <Lobby participants={participants} onStart={handleOpenTeamSetup} gameId={gameId} />
      )}

      {phase === 'team_setup' && (
        <TeamBuilder
          teams={sortedTeams}
          participants={participants}
          onAssign={assignParticipant}
          onSetLeader={setTeamLeader}
          onBegin={handleStartChallenge}
        />
      )}

      {phase !== 'lobby' && phase !== 'team_setup' && phase !== 'results' && (
        <RoundController
          phase={phase}
          round={activeRound}
          challenge={activeChallenge}
          participants={participants}
          teams={sortedTeams}
          votes={votes}
          lineups={lineups}
          onOpenVoting={openVoting}
          onLockVoting={lockVoting}
          onMarkLosingTeam={markLosingTeam}
          onNextRound={nextRound}
          onEndGame={endGame}
          onToggleLineup={toggleLineupParticipant}
        />
      )}

      {phase === 'results' && <Results gameId={gameId} />}
    </main>
  )
}
