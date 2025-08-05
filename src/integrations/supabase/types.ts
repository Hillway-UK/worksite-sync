export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      additional_costs: {
        Row: {
          amount: number
          cost_type: string
          created_at: string | null
          date: string
          description: string
          id: string
          worker_id: string
        }
        Insert: {
          amount: number
          cost_type: string
          created_at?: string | null
          date: string
          description: string
          id?: string
          worker_id: string
        }
        Update: {
          amount?: number
          cost_type?: string
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "additional_costs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "current_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "additional_costs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "weekly_summary"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "additional_costs_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      clock_entries: {
        Row: {
          clock_in: string
          clock_in_lat: number | null
          clock_in_lng: number | null
          clock_in_photo: string | null
          clock_out: string | null
          clock_out_lat: number | null
          clock_out_lng: number | null
          clock_out_photo: string | null
          created_at: string | null
          id: string
          job_id: string
          total_hours: number | null
          worker_id: string
        }
        Insert: {
          clock_in: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_photo?: string | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          clock_out_photo?: string | null
          created_at?: string | null
          id?: string
          job_id: string
          total_hours?: number | null
          worker_id: string
        }
        Update: {
          clock_in?: string
          clock_in_lat?: number | null
          clock_in_lng?: number | null
          clock_in_photo?: string | null
          clock_out?: string | null
          clock_out_lat?: number | null
          clock_out_lng?: number | null
          clock_out_photo?: string | null
          created_at?: string | null
          id?: string
          job_id?: string
          total_hours?: number | null
          worker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clock_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "current_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clock_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "weekly_summary"
            referencedColumns: ["worker_id"]
          },
          {
            foreignKeyName: "clock_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string
          code: string
          created_at: string | null
          geofence_radius: number | null
          id: string
          is_active: boolean | null
          latitude: number
          longitude: number
          name: string
        }
        Insert: {
          address: string
          code: string
          created_at?: string | null
          geofence_radius?: number | null
          id?: string
          is_active?: boolean | null
          latitude: number
          longitude: number
          name: string
        }
        Update: {
          address?: string
          code?: string
          created_at?: string | null
          geofence_radius?: number | null
          id?: string
          is_active?: boolean | null
          latitude?: number
          longitude?: number
          name?: string
        }
        Relationships: []
      }
      managers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_admin: boolean | null
          name: string
          pin: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_admin?: boolean | null
          name: string
          pin?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_admin?: boolean | null
          name?: string
          pin?: string | null
        }
        Relationships: []
      }
      workers: {
        Row: {
          created_at: string | null
          email: string
          hourly_rate: number
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          hourly_rate?: number
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          hourly_rate?: number
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      current_status: {
        Row: {
          clock_in: string | null
          clock_in_photo: string | null
          email: string | null
          id: string | null
          job_code: string | null
          job_name: string | null
          name: string | null
          status: string | null
        }
        Relationships: []
      }
      weekly_summary: {
        Row: {
          days_worked: number | null
          hourly_rate: number | null
          jobs_worked: number | null
          total_hours: number | null
          total_pay: number | null
          week_start: string | null
          worker_id: string | null
          worker_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
