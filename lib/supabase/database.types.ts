export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          id: string
          met: number | null
          name: string
          sort_order: number
          source: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          met?: number | null
          name: string
          sort_order?: number
          source?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          met?: number | null
          name?: string
          sort_order?: number
          source?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          calories: number
          carbs_g: number
          created_at: string
          doses: number | null
          entry_date: string
          fat_g: number
          id: string
          items: Json | null
          kind: string
          meal: string
          name: string
          protein_g: number
          quantity_g: number | null
          saved_food_id: string | null
          saved_meal_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calories: number
          carbs_g: number
          created_at?: string
          doses?: number | null
          entry_date: string
          fat_g: number
          id?: string
          items?: Json | null
          kind: string
          meal: string
          name: string
          protein_g: number
          quantity_g?: number | null
          saved_food_id?: string | null
          saved_meal_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          created_at?: string
          doses?: number | null
          entry_date?: string
          fat_g?: number
          id?: string
          items?: Json | null
          kind?: string
          meal?: string
          name?: string
          protein_g?: number
          quantity_g?: number | null
          saved_food_id?: string | null
          saved_meal_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diary_entries_user_id_saved_food_id_fkey"
            columns: ["user_id", "saved_food_id"]
            isOneToOne: false
            referencedRelation: "saved_foods"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "diary_entries_user_id_saved_meal_id_fkey"
            columns: ["user_id", "saved_meal_id"]
            isOneToOne: false
            referencedRelation: "saved_meals"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_sessions_per_week: number | null
          avatar: string | null
          aerobic_sessions_per_week: number | null
          anaerobic_sessions_per_week: number | null
          age: number | null
          body_fat_pct: number | null
          daily_activity: string | null
          exercise_types: string[]
          height_cm: number | null
          onboarding_done_at: string | null
          plan_summary: string | null
          saved_plans: Json | null
          sex: string | null
          training_intensity: string | null
          training_notes: string | null
          weight_kg: number | null
          created_at: string
          goal_calories: number
          goal_carbs: number
          goal_fat: number
          goal_protein: number
          mode: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_sessions_per_week?: number | null
          avatar?: string | null
          aerobic_sessions_per_week?: number | null
          anaerobic_sessions_per_week?: number | null
          age?: number | null
          body_fat_pct?: number | null
          daily_activity?: string | null
          exercise_types?: string[]
          height_cm?: number | null
          onboarding_done_at?: string | null
          plan_summary?: string | null
          saved_plans?: Json | null
          sex?: string | null
          training_intensity?: string | null
          training_notes?: string | null
          weight_kg?: number | null
          created_at?: string
          goal_calories?: number
          goal_carbs?: number
          goal_fat?: number
          goal_protein?: number
          mode?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          activity_sessions_per_week?: number | null
          avatar?: string | null
          aerobic_sessions_per_week?: number | null
          anaerobic_sessions_per_week?: number | null
          age?: number | null
          body_fat_pct?: number | null
          daily_activity?: string | null
          exercise_types?: string[]
          height_cm?: number | null
          onboarding_done_at?: string | null
          plan_summary?: string | null
          saved_plans?: Json | null
          sex?: string | null
          training_intensity?: string | null
          training_notes?: string | null
          weight_kg?: number | null
          created_at?: string
          goal_calories?: number
          goal_carbs?: number
          goal_fat?: number
          goal_protein?: number
          mode?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_foods: {
        Row: {
          brand: string | null
          calories_100g: number
          carbs_100g: number
          created_at: string
          fat_100g: number
          id: string
          name: string
          off_code: string | null
          protein_100g: number
          times_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          calories_100g: number
          carbs_100g: number
          created_at?: string
          fat_100g: number
          id?: string
          name: string
          off_code?: string | null
          protein_100g: number
          times_used?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          brand?: string | null
          calories_100g?: number
          carbs_100g?: number
          created_at?: string
          fat_100g?: number
          id?: string
          name?: string
          off_code?: string | null
          protein_100g?: number
          times_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_meals: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          times_used: number
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          times_used?: number
          total_calories: number
          total_carbs: number
          total_fat: number
          total_protein: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          times_used?: number
          total_calories?: number
          total_carbs?: number
          total_fat?: number
          total_protein?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_workouts: {
        Row: {
          created_at: string
          exercises: Json
          id: string
          name: string
          times_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercises: Json
          id?: string
          name: string
          times_used?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          exercises?: Json
          id?: string
          name?: string
          times_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      training_entries: {
        Row: {
          activity_id: string | null
          calories_est: number | null
          created_at: string
          duration_min: number | null
          entry_date: string
          exercises: Json | null
          id: string
          kind: string
          met: number | null
          name: string
          notes: string | null
          saved_workout_id: string | null
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity_id?: string | null
          calories_est?: number | null
          created_at?: string
          duration_min?: number | null
          entry_date: string
          exercises?: Json | null
          id?: string
          kind?: string
          met?: number | null
          name: string
          notes?: string | null
          saved_workout_id?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Update: {
          activity_id?: string | null
          calories_est?: number | null
          created_at?: string
          duration_min?: number | null
          entry_date?: string
          exercises?: Json | null
          id?: string
          kind?: string
          met?: number | null
          name?: string
          notes?: string | null
          saved_workout_id?: string | null
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "training_entries_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_entries_user_id_saved_workout_id_fkey"
            columns: ["user_id", "saved_workout_id"]
            isOneToOne: false
            referencedRelation: "saved_workouts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      diary_meal_totals: {
        Args: { p_from: string; p_to: string }
        Returns: {
          calories: number
          entries: number
          meal: string
        }[]
      }
      diary_top_items: {
        Args: { p_from: string; p_limit?: number; p_order: string; p_to: string }
        Returns: {
          kind: string
          name: string
          times: number
          total_calories: number
        }[]
      }
      training_daily_counts: {
        Args: { p_from: string; p_to: string }
        Returns: {
          entry_date: string
          trainings: number
        }[]
      }
      delete_my_account: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      diary_daily_totals: {
        Args: { p_from: string; p_to: string }
        Returns: {
          calories: number
          carbs_g: number
          entries: number
          entry_date: string
          fat_g: number
          protein_g: number
        }[]
      }
      apply_saved_food: {
        Args: { p_food_id: string; p_from_date?: string }
        Returns: number
      }
      apply_saved_meal: {
        Args: { p_from_date?: string; p_meal_id: string }
        Returns: number
      }
      upsert_saved_food: {
        Args: {
          p_brand: string
          p_calories_100g: number
          p_carbs_100g: number
          p_fat_100g: number
          p_name: string
          p_off_code: string
          p_protein_100g: number
        }
        Returns: string
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
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName]["Row"]

export type TablesInsert<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName]["Insert"]

export type TablesUpdate<
  TableName extends keyof DefaultSchema["Tables"],
> = DefaultSchema["Tables"][TableName]["Update"]
