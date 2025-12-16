import { createClient } from '@supabase/supabase-js'
import { Database } from './supabase'

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Participant = Database['public']['Tables']['participants']['Row']

export type BaseTeam = Database['public']['Tables']['teams']['Row']

export type GameTeam = Database['public']['Tables']['game_teams']['Row']

export type GameRound = Database['public']['Tables']['game_rounds']['Row']

export type RoundVote = Database['public']['Tables']['round_votes']['Row'] & {
  participant: Participant
  game_team: GameTeam
}

export type Game = Database['public']['Tables']['games']['Row']

export type GameChallenge = Database['public']['Tables']['game_challenges']['Row']

export type RoundLineup = Database['public']['Tables']['round_lineups']['Row']

export type TeamScore = Database['public']['Views']['team_scores']['Row']
