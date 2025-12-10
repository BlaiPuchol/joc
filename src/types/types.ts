import { createClient } from '@supabase/supabase-js'
import { Database } from './supabase'

export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Participant = Database['public']['Tables']['participants']['Row']

export type Team = Database['public']['Tables']['teams']['Row']

export type GameRound = Database['public']['Tables']['game_rounds']['Row']

export type RoundVote = Database['public']['Tables']['round_votes']['Row'] & {
  participant: Participant
  team: Team
}

export type Game = Database['public']['Tables']['games']['Row']

export type GameResult = Database['public']['Views']['game_results']['Row']
