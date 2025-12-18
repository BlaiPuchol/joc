export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      answers: {
        Row: {
          choice_id: string | null
          created_at: string
          id: string
          participant_id: string
          question_id: string
          score: number
        }
        Insert: {
          choice_id?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          question_id: string
          score: number
        }
        Update: {
          choice_id?: string | null
          created_at?: string
          id?: string
          participant_id?: string
          question_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "answers_choice_id_fkey"
            columns: ["choice_id"]
            isOneToOne: false
            referencedRelation: "choices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "answers_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      choices: {
        Row: {
          body: string
          created_at: string
          id: string
          is_correct: boolean
          question_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_correct?: boolean
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "choices_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_challenges: {
        Row: {
          created_at: string
          description: string | null
          game_id: string
          id: string
          participants_per_team: number | null
          position: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          game_id: string
          id?: string
          participants_per_team?: number | null
          position: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          game_id?: string
          id?: string
          participants_per_team?: number | null
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_challenges_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          challenge_id: string | null
          created_at: string
          game_id: string
          id: string
          leader_notes: string | null
          losing_team_id: string | null
          sequence: number
          state: string
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          game_id: string
          id?: string
          leader_notes?: string | null
          losing_team_id?: string | null
          sequence: number
          state?: string
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          game_id?: string
          id?: string
          leader_notes?: string | null
          losing_team_id?: string | null
          sequence?: number
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rounds_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "game_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_rounds_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_rounds_losing_game_team_id_fkey"
            columns: ["losing_team_id"]
            isOneToOne: false
            referencedRelation: "game_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_rounds_losing_game_team_id_fkey"
            columns: ["losing_team_id"]
            isOneToOne: false
            referencedRelation: "team_scores"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "game_rounds_losing_team_id_fkey"
            columns: ["losing_team_id"]
            isOneToOne: false
            referencedRelation: "game_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_rounds_losing_team_id_fkey"
            columns: ["losing_team_id"]
            isOneToOne: false
            referencedRelation: "team_scores"
            referencedColumns: ["team_id"]
          },
        ]
      }
      game_teams: {
        Row: {
          color_hex: string
          created_at: string
          game_id: string
          id: string
          is_active: boolean
          leader_participant_id: string | null
          name: string
          position: number
          slug: string | null
          template_team_id: string | null
        }
        Insert: {
          color_hex: string
          created_at?: string
          game_id: string
          id?: string
          is_active?: boolean
          leader_participant_id?: string | null
          name: string
          position: number
          slug?: string | null
          template_team_id?: string | null
        }
        Update: {
          color_hex?: string
          created_at?: string
          game_id?: string
          id?: string
          is_active?: boolean
          leader_participant_id?: string | null
          name?: string
          position?: number
          slug?: string | null
          template_team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_teams_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_teams_leader_participant_id_fkey"
            columns: ["leader_participant_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "game_teams_leader_participant_id_fkey"
            columns: ["leader_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_teams_template_team_id_fkey"
            columns: ["template_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          active_round_id: string | null
          created_at: string
          current_round_sequence: number
          description: string
          host_user_id: string | null
          id: string
          lobby_code: string
          max_players_per_team: number | null
          max_teams: number
          phase: string
          quiz_set_id: string | null
          status: string
          title: string
        }
        Insert: {
          active_round_id?: string | null
          created_at?: string
          current_round_sequence?: number
          description?: string
          host_user_id?: string | null
          id?: string
          lobby_code?: string
          max_players_per_team?: number | null
          max_teams?: number
          phase?: string
          quiz_set_id?: string | null
          status?: string
          title?: string
        }
        Update: {
          active_round_id?: string | null
          created_at?: string
          current_round_sequence?: number
          description?: string
          host_user_id?: string | null
          id?: string
          lobby_code?: string
          max_players_per_team?: number | null
          max_teams?: number
          phase?: string
          quiz_set_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_active_round_id_fkey"
            columns: ["active_round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_quiz_set_id_fkey"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          created_at: string
          game_id: string
          game_team_id: string | null
          id: string
          nickname: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_id: string
          game_team_id?: string | null
          id?: string
          nickname: string
          user_id?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          game_team_id?: string | null
          id?: string
          nickname?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_game_team_id_fkey"
            columns: ["game_team_id"]
            isOneToOne: false
            referencedRelation: "game_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "participants_game_team_id_fkey"
            columns: ["game_team_id"]
            isOneToOne: false
            referencedRelation: "team_scores"
            referencedColumns: ["team_id"]
          },
        ]
      }
      questions: {
        Row: {
          body: string
          created_at: string
          id: string
          image_url: string | null
          order: number
          quiz_set_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          order: number
          quiz_set_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          order?: number
          quiz_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_set_id_fkey"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      round_lineups: {
        Row: {
          created_at: string
          id: string
          participant_id: string
          round_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_id: string
          round_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_id?: string
          round_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_lineups_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "round_lineups_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_lineups_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "game_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_scores"
            referencedColumns: ["team_id"]
          },
        ]
      }
      round_outcomes: {
        Row: {
          challenge_points: number
          created_at: string
          id: string
          is_loser: boolean
          round_id: string
          team_id: string
        }
        Insert: {
          challenge_points?: number
          created_at?: string
          id?: string
          is_loser?: boolean
          round_id: string
          team_id: string
        }
        Update: {
          challenge_points?: number
          created_at?: string
          id?: string
          is_loser?: boolean
          round_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_outcomes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_outcomes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "game_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_outcomes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_scores"
            referencedColumns: ["team_id"]
          },
        ]
      }
      round_votes: {
        Row: {
          created_at: string
          game_team_id: string
          id: string
          participant_id: string
          round_id: string
        }
        Insert: {
          created_at?: string
          game_team_id: string
          id?: string
          participant_id: string
          round_id: string
        }
        Update: {
          created_at?: string
          game_team_id?: string
          id?: string
          participant_id?: string
          round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "round_votes_game_team_id_fkey"
            columns: ["game_team_id"]
            isOneToOne: false
            referencedRelation: "game_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_votes_game_team_id_fkey"
            columns: ["game_team_id"]
            isOneToOne: false
            referencedRelation: "team_scores"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "round_votes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["participant_id"]
          },
          {
            foreignKeyName: "round_votes_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_votes_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color_hex: string
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          color_hex: string
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          color_hex?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      game_results: {
        Row: {
          game_id: string | null
          nickname: string | null
          participant_id: string | null
          total_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      team_scores: {
        Row: {
          color_hex: string | null
          game_id: string | null
          name: string | null
          team_id: string | null
          total_score: number | null
        }
        Relationships: [
          {
            foreignKeyName: "game_teams_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_question: {
        Args: {
          body: string
          choices: Json[]
          order: number
          quiz_set_id: string
        }
        Returns: undefined
      }
      reset_game_state: {
        Args: {
          game_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

