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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      associations: {
        Row: {
          city: string
          created_at: string
          due_day: number
          dues_cadence: Database["public"]["Enums"]["dues_cadence"]
          dues_cents: number
          ein: string | null
          fiscal_year_start: string
          id: string
          late_after_day: number
          name: string
          state: string
          stripe_account_id: string | null
        }
        Insert: {
          city: string
          created_at?: string
          due_day?: number
          dues_cadence?: Database["public"]["Enums"]["dues_cadence"]
          dues_cents: number
          ein?: string | null
          fiscal_year_start?: string
          id?: string
          late_after_day?: number
          name: string
          state: string
          stripe_account_id?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          due_day?: number
          dues_cadence?: Database["public"]["Enums"]["dues_cadence"]
          dues_cents?: number
          ein?: string | null
          fiscal_year_start?: string
          id?: string
          late_after_day?: number
          name?: string
          state?: string
          stripe_account_id?: string | null
        }
        Relationships: []
      }
      bank_accounts: {
        Row: {
          association_id: string
          created_at: string
          id: string
          institution: string
          kind: Database["public"]["Enums"]["account_kind"]
          mask: string
          stripe_payment_method_id: string | null
          verified_at: string | null
        }
        Insert: {
          association_id: string
          created_at?: string
          id?: string
          institution: string
          kind: Database["public"]["Enums"]["account_kind"]
          mask: string
          stripe_payment_method_id?: string | null
          verified_at?: string | null
        }
        Update: {
          association_id?: string
          created_at?: string
          id?: string
          institution?: string
          kind?: Database["public"]["Enums"]["account_kind"]
          mask?: string
          stripe_payment_method_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount_cents: number
          association_id: string
          created_at: string
          due_on: string
          id: string
          kind: Database["public"]["Enums"]["charge_kind"]
          label: string
          unit_id: string
        }
        Insert: {
          amount_cents: number
          association_id: string
          created_at?: string
          due_on: string
          id?: string
          kind: Database["public"]["Enums"]["charge_kind"]
          label: string
          unit_id: string
        }
        Update: {
          amount_cents?: number
          association_id?: string
          created_at?: string
          due_on?: string
          id?: string
          kind?: Database["public"]["Enums"]["charge_kind"]
          label?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "charges_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount_cents: number
          association_id: string
          bank_account_id: string | null
          category: string
          confirmed_at: string | null
          counterparty: string
          created_at: string
          description: string
          id: string
          occurred_on: string
          payment_id: string | null
        }
        Insert: {
          amount_cents: number
          association_id: string
          bank_account_id?: string | null
          category: string
          confirmed_at?: string | null
          counterparty?: string
          created_at?: string
          description: string
          id?: string
          occurred_on: string
          payment_id?: string | null
        }
        Update: {
          amount_cents?: number
          association_id?: string
          bank_account_id?: string | null
          category?: string
          confirmed_at?: string | null
          counterparty?: string
          created_at?: string
          description?: string
          id?: string
          occurred_on?: string
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          association_id: string
          capabilities: Database["public"]["Enums"]["capability"][]
          created_at: string
          ends_on: string | null
          full_name: string
          id: string
          invited_email: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["board_role"]
          starts_on: string
          unit_id: string
        }
        Insert: {
          association_id: string
          capabilities?: Database["public"]["Enums"]["capability"][]
          created_at?: string
          ends_on?: string | null
          full_name: string
          id?: string
          invited_email?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["board_role"]
          starts_on?: string
          unit_id: string
        }
        Update: {
          association_id?: string
          capabilities?: Database["public"]["Enums"]["capability"][]
          created_at?: string
          ends_on?: string | null
          full_name?: string
          id?: string
          invited_email?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["board_role"]
          starts_on?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "memberships_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          amount_cents: number
          charge_id: string
          payment_id: string
        }
        Insert: {
          amount_cents: number
          charge_id: string
          payment_id: string
        }
        Update: {
          amount_cents?: number
          charge_id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          association_id: string
          created_at: string
          id: string
          paid_by: string | null
          platform_fee_cents: number
          processor_fee_cents: number
          rail: Database["public"]["Enums"]["payment_rail"]
          settled_at: string | null
          state: Database["public"]["Enums"]["payment_state"]
          stripe_payment_intent_id: string | null
          unit_id: string
        }
        Insert: {
          amount_cents: number
          association_id: string
          created_at?: string
          id?: string
          paid_by?: string | null
          platform_fee_cents?: number
          processor_fee_cents?: number
          rail: Database["public"]["Enums"]["payment_rail"]
          settled_at?: string | null
          state?: Database["public"]["Enums"]["payment_state"]
          stripe_payment_intent_id?: string | null
          unit_id: string
        }
        Update: {
          amount_cents?: number
          association_id?: string
          created_at?: string
          id?: string
          paid_by?: string | null
          platform_fee_cents?: number
          processor_fee_cents?: number
          rail?: Database["public"]["Enums"]["payment_rail"]
          settled_at?: string | null
          state?: Database["public"]["Enums"]["payment_state"]
          stripe_payment_intent_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          phone?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          address: string
          association_id: string
          created_at: string
          id: string
          label: string
        }
        Insert: {
          address?: string
          association_id: string
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          address?: string
          association_id?: string
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      unit_balances: {
        Row: {
          association_id: string | null
          balance_cents: number | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_capability: {
        Args: {
          needed: Database["public"]["Enums"]["capability"]
          target: string
        }
        Returns: boolean
      }
      is_member_of: { Args: { target: string }; Returns: boolean }
      my_unit_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      account_kind: "operating" | "reserve" | "cd"
      board_role:
        | "resident"
        | "president"
        | "vice-president"
        | "treasurer"
        | "secretary"
      capability:
        | "finances"
        | "requests"
        | "documents"
        | "communications"
        | "voting"
        | "vendors"
        | "compliance"
        | "forum"
        | "settings"
        | "permissions"
      charge_kind: "charge" | "payment" | "credit"
      dues_cadence: "monthly" | "quarterly" | "annually"
      payment_rail: "ach" | "card" | "apple-pay" | "google-pay"
      payment_state: "pending" | "settled" | "failed" | "refunded"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_kind: ["operating", "reserve", "cd"],
      board_role: [
        "resident",
        "president",
        "vice-president",
        "treasurer",
        "secretary",
      ],
      capability: [
        "finances",
        "requests",
        "documents",
        "communications",
        "voting",
        "vendors",
        "compliance",
        "forum",
        "settings",
        "permissions",
      ],
      charge_kind: ["charge", "payment", "credit"],
      dues_cadence: ["monthly", "quarterly", "annually"],
      payment_rail: ["ach", "card", "apple-pay", "google-pay"],
      payment_state: ["pending", "settled", "failed", "refunded"],
    },
  },
} as const
