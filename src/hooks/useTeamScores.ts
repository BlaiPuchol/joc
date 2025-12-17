import { TeamScore, supabase } from '@/types/types'
import { useCallback, useEffect, useState } from 'react'

type Options = {
  refreshIntervalMs?: number
}

export function useTeamScores(gameId: string | null, options?: Options) {
  const [scores, setScores] = useState<TeamScore[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!gameId) {
      setScores([])
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('team_scores')
      .select('*')
      .eq('game_id', gameId)
      .order('total_score', { ascending: false })

    if (error) {
      console.error(error.message)
      setLoading(false)
      return
    }

    setScores((data ?? []) as TeamScore[])
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!options?.refreshIntervalMs) return
    const id = setInterval(() => {
      load()
    }, options.refreshIntervalMs)
    return () => clearInterval(id)
  }, [load, options?.refreshIntervalMs])

  return { scores, loading, reload: load }
}
