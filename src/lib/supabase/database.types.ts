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
      amenities: {
        Row: {
          association_id: string
          detail: string
          id: string
          max_hours: number | null
          name: string
          reservable: boolean
          status: string
        }
        Insert: {
          association_id: string
          detail?: string
          id?: string
          max_hours?: number | null
          name: string
          reservable?: boolean
          status?: string
        }
        Update: {
          association_id?: string
          detail?: string
          id?: string
          max_hours?: number | null
          name?: string
          reservable?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "amenities_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      associations: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          city: string
          created_at: string
          deleted_at: string | null
          deletion_requested_by: string | null
          due_day: number
          dues_cadence: Database["public"]["Enums"]["dues_cadence"]
          dues_cents: number
          ein: string | null
          fiscal_year_start: string
          id: string
          insurance_carrier: string | null
          insurance_expires_on: string | null
          insurance_policy_no: string | null
          late_after_day: number
          name: string
          payment_fee_cents: number
          payment_fee_paid_by: string
          payment_fee_waived_on_ach: boolean
          photo_credit: string | null
          photo_url: string | null
          setup_completed_at: string | null
          software_fee_cents_per_home: number
          state: string
          stripe_account_id: string | null
          subscription_status: string
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          city: string
          created_at?: string
          deleted_at?: string | null
          deletion_requested_by?: string | null
          due_day?: number
          dues_cadence?: Database["public"]["Enums"]["dues_cadence"]
          dues_cents: number
          ein?: string | null
          fiscal_year_start?: string
          id?: string
          insurance_carrier?: string | null
          insurance_expires_on?: string | null
          insurance_policy_no?: string | null
          late_after_day?: number
          name: string
          payment_fee_cents?: number
          payment_fee_paid_by?: string
          payment_fee_waived_on_ach?: boolean
          photo_credit?: string | null
          photo_url?: string | null
          setup_completed_at?: string | null
          software_fee_cents_per_home?: number
          state: string
          stripe_account_id?: string | null
          subscription_status?: string
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          city?: string
          created_at?: string
          deleted_at?: string | null
          deletion_requested_by?: string | null
          due_day?: number
          dues_cadence?: Database["public"]["Enums"]["dues_cadence"]
          dues_cents?: number
          ein?: string | null
          fiscal_year_start?: string
          id?: string
          insurance_carrier?: string | null
          insurance_expires_on?: string | null
          insurance_policy_no?: string | null
          late_after_day?: number
          name?: string
          payment_fee_cents?: number
          payment_fee_paid_by?: string
          payment_fee_waived_on_ach?: boolean
          photo_credit?: string | null
          photo_url?: string | null
          setup_completed_at?: string | null
          software_fee_cents_per_home?: number
          state?: string
          stripe_account_id?: string | null
          subscription_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "associations_deletion_requested_by_fkey"
            columns: ["deletion_requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ballot_options: {
        Row: {
          ballot_id: string
          detail: string | null
          id: string
          label: string
          position: number
        }
        Insert: {
          ballot_id: string
          detail?: string | null
          id?: string
          label: string
          position?: number
        }
        Update: {
          ballot_id?: string
          detail?: string | null
          id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "ballot_options_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballot_turnout"
            referencedColumns: ["ballot_id"]
          },
          {
            foreignKeyName: "ballot_options_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballots"
            referencedColumns: ["id"]
          },
        ]
      }
      ballots: {
        Row: {
          association_id: string
          body: string[]
          closes_on: string
          created_at: string
          id: string
          kind: string
          meeting_id: string | null
          opens_on: string
          quorum_required: number
          seats: number
          status: Database["public"]["Enums"]["ballot_status"]
          threshold_label: string
          title: string
        }
        Insert: {
          association_id: string
          body?: string[]
          closes_on: string
          created_at?: string
          id?: string
          kind?: string
          meeting_id?: string | null
          opens_on: string
          quorum_required?: number
          seats?: number
          status?: Database["public"]["Enums"]["ballot_status"]
          threshold_label?: string
          title: string
        }
        Update: {
          association_id?: string
          body?: string[]
          closes_on?: string
          created_at?: string
          id?: string
          kind?: string
          meeting_id?: string | null
          opens_on?: string
          quorum_required?: number
          seats?: number
          status?: Database["public"]["Enums"]["ballot_status"]
          threshold_label?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ballots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ballots_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
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
      documents: {
        Row: {
          association_id: string
          category: string
          created_at: string
          id: string
          name: string
          size_label: string
          storage_path: string | null
          updated_on: string
          visibility: Database["public"]["Enums"]["doc_visibility"]
        }
        Insert: {
          association_id: string
          category?: string
          created_at?: string
          id?: string
          name: string
          size_label?: string
          storage_path?: string | null
          updated_on?: string
          visibility?: Database["public"]["Enums"]["doc_visibility"]
        }
        Update: {
          association_id?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
          size_label?: string
          storage_path?: string | null
          updated_on?: string
          visibility?: Database["public"]["Enums"]["doc_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          association_id: string
          category: Database["public"]["Enums"]["email_category"]
          error: string | null
          id: string
          profile_id: string | null
          provider_id: string | null
          sent_at: string
          subject: string
          to_email: string
          unit_id: string | null
        }
        Insert: {
          association_id: string
          category: Database["public"]["Enums"]["email_category"]
          error?: string | null
          id?: string
          profile_id?: string | null
          provider_id?: string | null
          sent_at?: string
          subject: string
          to_email: string
          unit_id?: string | null
        }
        Update: {
          association_id?: string
          category?: Database["public"]["Enums"]["email_category"]
          error?: string | null
          id?: string
          profile_id?: string | null
          provider_id?: string | null
          sent_at?: string
          subject?: string
          to_email?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_log_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "email_log_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      email_optouts: {
        Row: {
          category: Database["public"]["Enums"]["email_category"]
          opted_out_at: string
          profile_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["email_category"]
          opted_out_at?: string
          profile_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["email_category"]
          opted_out_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_optouts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      meetings: {
        Row: {
          association_id: string
          created_at: string
          dial_in: string | null
          held_at: string
          held_on: string
          id: string
          location: string
          passcode: string | null
          status: string
          title: string
        }
        Insert: {
          association_id: string
          created_at?: string
          dial_in?: string | null
          held_at?: string
          held_on: string
          id?: string
          location?: string
          passcode?: string | null
          status?: string
          title: string
        }
        Update: {
          association_id?: string
          created_at?: string
          dial_in?: string | null
          held_at?: string
          held_on?: string
          id?: string
          location?: string
          passcode?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
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
      posts: {
        Row: {
          association_id: string
          author_id: string | null
          author_name: string
          body: string
          category: string
          created_at: string
          id: string
          likes: number
          moderated_at: string | null
          moderated_by: string | null
          pinned: boolean
          status: Database["public"]["Enums"]["post_status"]
          title: string
        }
        Insert: {
          association_id: string
          author_id?: string | null
          author_name: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          likes?: number
          moderated_at?: string | null
          moderated_by?: string | null
          pinned?: boolean
          status?: Database["public"]["Enums"]["post_status"]
          title: string
        }
        Update: {
          association_id?: string
          author_id?: string | null
          author_name?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          likes?: number
          moderated_at?: string | null
          moderated_by?: string | null
          pinned?: boolean
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      requests: {
        Row: {
          association_id: string
          body: string
          created_at: string
          decided_note: string | null
          filed_by: string | null
          id: string
          kind: Database["public"]["Enums"]["request_kind"]
          reference: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_on: string
          title: string
          unit_id: string
        }
        Insert: {
          association_id: string
          body?: string
          created_at?: string
          decided_note?: string | null
          filed_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["request_kind"]
          reference: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_on?: string
          title: string
          unit_id: string
        }
        Update: {
          association_id?: string
          body?: string
          created_at?: string
          decided_note?: string | null
          filed_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["request_kind"]
          reference?: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_on?: string
          title?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_filed_by_fkey"
            columns: ["filed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "requests_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      setup_dismissals: {
        Row: {
          association_id: string
          dismissed_at: string
          dismissed_by: string | null
          note: string | null
          task_key: string
        }
        Insert: {
          association_id: string
          dismissed_at?: string
          dismissed_by?: string | null
          note?: string | null
          task_key: string
        }
        Update: {
          association_id?: string
          dismissed_at?: string
          dismissed_by?: string | null
          note?: string | null
          task_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_dismissals_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setup_dismissals_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      vendors: {
        Row: {
          ach_enabled: boolean
          association_id: string
          coi_expires_on: string | null
          created_at: string
          default_category: string
          id: string
          name: string
          service: string
          w9_on_file: boolean
        }
        Insert: {
          ach_enabled?: boolean
          association_id: string
          coi_expires_on?: string | null
          created_at?: string
          default_category?: string
          id?: string
          name: string
          service?: string
          w9_on_file?: boolean
        }
        Update: {
          ach_enabled?: boolean
          association_id?: string
          coi_expires_on?: string | null
          created_at?: string
          default_category?: string
          id?: string
          name?: string
          service?: string
          w9_on_file?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "vendors_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          ballot_id: string
          cast_at: string
          option_id: string
          receipt: string
          unit_id: string
        }
        Insert: {
          ballot_id: string
          cast_at?: string
          option_id: string
          receipt: string
          unit_id: string
        }
        Update: {
          ballot_id?: string
          cast_at?: string
          option_id?: string
          receipt?: string
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballot_turnout"
            referencedColumns: ["ballot_id"]
          },
          {
            foreignKeyName: "votes_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "ballot_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "ballot_tallies"
            referencedColumns: ["option_id"]
          },
          {
            foreignKeyName: "votes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "votes_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ballot_tallies: {
        Row: {
          ballot_id: string | null
          label: string | null
          option_id: string | null
          votes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ballot_options_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballot_turnout"
            referencedColumns: ["ballot_id"]
          },
          {
            foreignKeyName: "ballot_options_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballots"
            referencedColumns: ["id"]
          },
        ]
      }
      ballot_turnout: {
        Row: {
          association_id: string | null
          ballot_id: string | null
          homes_voted: number | null
          quorum_required: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ballots_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cancel_association_deletion: {
        Args: { p_association_id: string }
        Returns: undefined
      }
      cancel_subscription: {
        Args: { p_association_id: string; p_reason?: string }
        Returns: undefined
      }
      cast_vote: {
        Args: { p_ballot_id: string; p_option_id: string }
        Returns: string
      }
      create_association: {
        Args: {
          p_city: string
          p_due_day: number
          p_dues_cadence: Database["public"]["Enums"]["dues_cadence"]
          p_dues_cents: number
          p_founder_name: string
          p_founder_unit: string
          p_households?: Json
          p_name: string
          p_state: string
        }
        Returns: string
      }
      email_recipients: {
        Args: {
          p_association_id: string
          p_category: Database["public"]["Enums"]["email_category"]
          p_only_past_due?: boolean
        }
        Returns: {
          balance_cents: number
          email: string
          full_name: string
          profile_id: string
          unit_id: string
          unit_label: string
        }[]
      }
      has_capability: {
        Args: {
          needed: Database["public"]["Enums"]["capability"]
          target: string
        }
        Returns: boolean
      }
      is_member_of: { Args: { target: string }; Returns: boolean }
      is_statutory: {
        Args: { c: Database["public"]["Enums"]["email_category"] }
        Returns: boolean
      }
      issue_assessment: {
        Args: { p_association_id: string; p_due_on: string; p_label: string }
        Returns: number
      }
      leave_association: {
        Args: { p_association_id: string }
        Returns: undefined
      }
      my_associations: {
        Args: never
        Returns: {
          association_id: string
          capabilities: Database["public"]["Enums"]["capability"][]
          name: string
          role: Database["public"]["Enums"]["board_role"]
        }[]
      }
      my_unit_ids: { Args: never; Returns: string[] }
      record_payment: {
        Args: {
          p_amount_cents: number
          p_platform_fee_cents?: number
          p_platform_fee_paid_by?: string
          p_processor_fee_cents?: number
          p_rail: Database["public"]["Enums"]["payment_rail"]
          p_stripe_payment_intent_id?: string
          p_unit_id: string
        }
        Returns: string
      }
      request_association_deletion: {
        Args: { p_association_id: string; p_typed_name: string }
        Returns: string
      }
      resume_subscription: {
        Args: { p_association_id: string }
        Returns: undefined
      }
      transfer_presidency: {
        Args: { p_to_profile: string }
        Returns: undefined
      }
    }
    Enums: {
      account_kind: "operating" | "reserve" | "cd"
      ballot_status: "scheduled" | "open" | "closed" | "certified"
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
      doc_visibility: "public" | "owners" | "board"
      dues_cadence: "monthly" | "quarterly" | "annually"
      email_category:
        | "assessment"
        | "delinquency"
        | "meeting"
        | "ballot"
        | "community"
        | "newsletter"
      payment_rail: "ach" | "card" | "apple-pay" | "google-pay"
      payment_state: "pending" | "settled" | "failed" | "refunded"
      post_status: "pending" | "published" | "rejected"
      request_kind: "maintenance" | "architectural" | "records" | "amenity"
      request_status:
        | "submitted"
        | "in-review"
        | "approved"
        | "denied"
        | "closed"
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
      ballot_status: ["scheduled", "open", "closed", "certified"],
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
      doc_visibility: ["public", "owners", "board"],
      dues_cadence: ["monthly", "quarterly", "annually"],
      email_category: [
        "assessment",
        "delinquency",
        "meeting",
        "ballot",
        "community",
        "newsletter",
      ],
      payment_rail: ["ach", "card", "apple-pay", "google-pay"],
      payment_state: ["pending", "settled", "failed", "refunded"],
      post_status: ["pending", "published", "rejected"],
      request_kind: ["maintenance", "architectural", "records", "amenity"],
      request_status: [
        "submitted",
        "in-review",
        "approved",
        "denied",
        "closed",
      ],
    },
  },
} as const
