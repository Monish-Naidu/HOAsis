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
    PostgrestVersion: "14.5"
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
      action_items: {
        Row: {
          association_id: string
          created_at: string
          created_by: string | null
          done_on: string | null
          due_on: string | null
          id: string
          meeting_id: string | null
          owner_name: string
          title: string
        }
        Insert: {
          association_id: string
          created_at?: string
          created_by?: string | null
          done_on?: string | null
          due_on?: string | null
          id?: string
          meeting_id?: string | null
          owner_name?: string
          title: string
        }
        Update: {
          association_id?: string
          created_at?: string
          created_by?: string | null
          done_on?: string | null
          due_on?: string | null
          id?: string
          meeting_id?: string | null
          owner_name?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      amenities: {
        Row: {
          association_id: string
          detail: string
          id: string
          max_hours: number | null
          name: string
          reservable: boolean
          rules: Json | null
          status: string
        }
        Insert: {
          association_id: string
          detail?: string
          id?: string
          max_hours?: number | null
          name: string
          reservable?: boolean
          rules?: Json | null
          status?: string
        }
        Update: {
          association_id?: string
          detail?: string
          id?: string
          max_hours?: number | null
          name?: string
          reservable?: boolean
          rules?: Json | null
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
      announcements: {
        Row: {
          association_id: string
          author_name: string
          body: string
          category: string
          created_at: string
          id: string
          pinned: boolean
          posted_on: string
          title: string
        }
        Insert: {
          association_id: string
          author_name: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          pinned?: boolean
          posted_on?: string
          title: string
        }
        Update: {
          association_id?: string
          author_name?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          pinned?: boolean
          posted_on?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      associations: {
        Row: {
          billing_brand: string | null
          billing_customer_id: string | null
          billing_email: string | null
          billing_last4: string | null
          billing_notices: string[]
          billing_subscription_id: string | null
          cancel_reason: string | null
          canceled_at: string | null
          city: string
          collects: string[]
          created_at: string
          deleted_at: string | null
          deletion_requested_by: string | null
          due_day: number
          dues_by_type: Json
          dues_cadence: Database["public"]["Enums"]["dues_cadence"]
          dues_cents: number
          ein: string | null
          fiscal_year_start: string
          home_types: Database["public"]["Enums"]["property_type"][]
          id: string
          insurance_carrier: string | null
          insurance_expires_on: string | null
          insurance_policy_no: string | null
          join_code: string
          late_after_day: number
          name: string
          origin: Database["public"]["Enums"]["association_origin"] | null
          past_due_since: string | null
          payment_fee_cents: number
          payment_fee_paid_by: string
          payment_fee_waived_on_ach: boolean
          photo_credit: string | null
          photo_url: string | null
          previously: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          settings: Json
          setup_completed_at: string | null
          shared_spaces: string[]
          software_fee_cents_per_home: number
          state: string
          stripe_account_id: string | null
          subscription_status: string
          trial_ends_at: string
        }
        Insert: {
          billing_brand?: string | null
          billing_customer_id?: string | null
          billing_email?: string | null
          billing_last4?: string | null
          billing_notices?: string[]
          billing_subscription_id?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          city: string
          collects?: string[]
          created_at?: string
          deleted_at?: string | null
          deletion_requested_by?: string | null
          due_day?: number
          dues_by_type?: Json
          dues_cadence?: Database["public"]["Enums"]["dues_cadence"]
          dues_cents: number
          ein?: string | null
          fiscal_year_start?: string
          home_types?: Database["public"]["Enums"]["property_type"][]
          id?: string
          insurance_carrier?: string | null
          insurance_expires_on?: string | null
          insurance_policy_no?: string | null
          join_code?: string
          late_after_day?: number
          name: string
          origin?: Database["public"]["Enums"]["association_origin"] | null
          past_due_since?: string | null
          payment_fee_cents?: number
          payment_fee_paid_by?: string
          payment_fee_waived_on_ach?: boolean
          photo_credit?: string | null
          photo_url?: string | null
          previously?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          settings?: Json
          setup_completed_at?: string | null
          shared_spaces?: string[]
          software_fee_cents_per_home?: number
          state: string
          stripe_account_id?: string | null
          subscription_status?: string
          trial_ends_at?: string
        }
        Update: {
          billing_brand?: string | null
          billing_customer_id?: string | null
          billing_email?: string | null
          billing_last4?: string | null
          billing_notices?: string[]
          billing_subscription_id?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          city?: string
          collects?: string[]
          created_at?: string
          deleted_at?: string | null
          deletion_requested_by?: string | null
          due_day?: number
          dues_by_type?: Json
          dues_cadence?: Database["public"]["Enums"]["dues_cadence"]
          dues_cents?: number
          ein?: string | null
          fiscal_year_start?: string
          home_types?: Database["public"]["Enums"]["property_type"][]
          id?: string
          insurance_carrier?: string | null
          insurance_expires_on?: string | null
          insurance_policy_no?: string | null
          join_code?: string
          late_after_day?: number
          name?: string
          origin?: Database["public"]["Enums"]["association_origin"] | null
          past_due_since?: string | null
          payment_fee_cents?: number
          payment_fee_paid_by?: string
          payment_fee_waived_on_ach?: boolean
          photo_credit?: string | null
          photo_url?: string | null
          previously?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          settings?: Json
          setup_completed_at?: string | null
          shared_spaces?: string[]
          software_fee_cents_per_home?: number
          state?: string
          stripe_account_id?: string | null
          subscription_status?: string
          trial_ends_at?: string
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
      autopay_runs: {
        Row: {
          amount_cents: number
          association_id: string
          created_at: string
          id: string
          month: string
          rail: string | null
          reason: string | null
          state: string
          stripe_payment_intent_id: string | null
          unit_id: string
        }
        Insert: {
          amount_cents?: number
          association_id: string
          created_at?: string
          id?: string
          month: string
          rail?: string | null
          reason?: string | null
          state: string
          stripe_payment_intent_id?: string | null
          unit_id: string
        }
        Update: {
          amount_cents?: number
          association_id?: string
          created_at?: string
          id?: string
          month?: string
          rail?: string | null
          reason?: string | null
          state?: string
          stripe_payment_intent_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopay_runs_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopay_runs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "autopay_runs_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
          audience: string
          body: string[]
          certified_by: string | null
          certified_on: string | null
          closes_on: string
          created_at: string
          id: string
          kind: string
          live_results_visible: boolean
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
          audience?: string
          body?: string[]
          certified_by?: string | null
          certified_on?: string | null
          closes_on: string
          created_at?: string
          id?: string
          kind?: string
          live_results_visible?: boolean
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
          audience?: string
          body?: string[]
          certified_by?: string | null
          certified_on?: string | null
          closes_on?: string
          created_at?: string
          id?: string
          kind?: string
          live_results_visible?: boolean
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
      budget_lines: {
        Row: {
          annual_cents: number
          association_id: string
          category: string
          created_at: string
          id: string
          kind: string
          position: number
        }
        Insert: {
          annual_cents?: number
          association_id: string
          category: string
          created_at?: string
          id?: string
          kind: string
          position?: number
        }
        Update: {
          annual_cents?: number
          association_id?: string
          category?: string
          created_at?: string
          id?: string
          kind?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "budget_lines_association_id_fkey"
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
          category: Database["public"]["Enums"]["charge_category"]
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
          category?: Database["public"]["Enums"]["charge_category"]
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
          category?: Database["public"]["Enums"]["charge_category"]
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
          status: string | null
          status_at: string | null
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
          status?: string | null
          status_at?: string | null
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
          status?: string | null
          status_at?: string | null
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
      forms: {
        Row: {
          association_id: string
          created_at: string
          decision_days: number | null
          description: string
          fields: Json | null
          file_name: string
          governed_by: string | null
          id: string
          label: string
          size_label: string
          updated_on: string
        }
        Insert: {
          association_id: string
          created_at?: string
          decision_days?: number | null
          description?: string
          fields?: Json | null
          file_name?: string
          governed_by?: string | null
          id?: string
          label: string
          size_label?: string
          updated_on?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          decision_days?: number | null
          description?: string
          fields?: Json | null
          file_name?: string
          governed_by?: string | null
          id?: string
          label?: string
          size_label?: string
          updated_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      governing_articles: {
        Row: {
          adopted_on: string | null
          affects: string
          amended_on: string | null
          amendment_ballot_id: string | null
          association_id: string
          created_at: string
          disclosure_topics: Json | null
          document: string
          extraction: Json | null
          id: string
          number: string
          plain: string | null
          position: number
          text: Json
          title: string
          topic: string
        }
        Insert: {
          adopted_on?: string | null
          affects?: string
          amended_on?: string | null
          amendment_ballot_id?: string | null
          association_id: string
          created_at?: string
          disclosure_topics?: Json | null
          document: string
          extraction?: Json | null
          id?: string
          number: string
          plain?: string | null
          position?: number
          text?: Json
          title?: string
          topic?: string
        }
        Update: {
          adopted_on?: string | null
          affects?: string
          amended_on?: string | null
          amendment_ballot_id?: string | null
          association_id?: string
          created_at?: string
          disclosure_topics?: Json | null
          document?: string
          extraction?: Json | null
          id?: string
          number?: string
          plain?: string | null
          position?: number
          text?: Json
          title?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "governing_articles_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          association_id: string
          created_at: string
          decided_by: string | null
          decided_on: string | null
          email: string
          full_name: string
          id: string
          note: string
          status: string
          unit_label: string
        }
        Insert: {
          association_id: string
          created_at?: string
          decided_by?: string | null
          decided_on?: string | null
          email: string
          full_name: string
          id?: string
          note?: string
          status?: string
          unit_label?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          decided_by?: string | null
          decided_on?: string | null
          email?: string
          full_name?: string
          id?: string
          note?: string
          status?: string
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
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
          agenda: Json
          association_id: string
          created_at: string
          dial_in: string | null
          held_at: string
          held_on: string
          id: string
          kind: string
          location: string
          notice_sent_on: string | null
          passcode: string | null
          rsvps: Json
          status: string
          title: string
        }
        Insert: {
          agenda?: Json
          association_id: string
          created_at?: string
          dial_in?: string | null
          held_at?: string
          held_on: string
          id?: string
          kind?: string
          location?: string
          notice_sent_on?: string | null
          passcode?: string | null
          rsvps?: Json
          status?: string
          title: string
        }
        Update: {
          agenda?: Json
          association_id?: string
          created_at?: string
          dial_in?: string | null
          held_at?: string
          held_on?: string
          id?: string
          kind?: string
          location?: string
          notice_sent_on?: string | null
          passcode?: string | null
          rsvps?: Json
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
          autopay: Json | null
          capabilities: Database["public"]["Enums"]["capability"][]
          created_at: string
          ends_on: string | null
          full_name: string
          id: string
          invited_email: string | null
          mailing_address: string
          phone: string
          profile_id: string | null
          role: Database["public"]["Enums"]["board_role"]
          starts_on: string
          unit_id: string
        }
        Insert: {
          association_id: string
          autopay?: Json | null
          capabilities?: Database["public"]["Enums"]["capability"][]
          created_at?: string
          ends_on?: string | null
          full_name: string
          id?: string
          invited_email?: string | null
          mailing_address?: string
          phone?: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["board_role"]
          starts_on?: string
          unit_id: string
        }
        Update: {
          association_id?: string
          autopay?: Json | null
          capabilities?: Database["public"]["Enums"]["capability"][]
          created_at?: string
          ends_on?: string | null
          full_name?: string
          id?: string
          invited_email?: string | null
          mailing_address?: string
          phone?: string
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
      message_templates: {
        Row: {
          association_id: string
          baseline_id: string | null
          body: string
          created_at: string
          description: string
          id: string
          name: string
          subject: string
          trigger: string
          updated_on: string
        }
        Insert: {
          association_id: string
          baseline_id?: string | null
          body?: string
          created_at?: string
          description?: string
          id?: string
          name: string
          subject?: string
          trigger?: string
          updated_on?: string
        }
        Update: {
          association_id?: string
          baseline_id?: string | null
          body?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          subject?: string
          trigger?: string
          updated_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
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
      payment_instruments: {
        Row: {
          added_on: string
          association_id: string
          created_at: string
          detail: Json
          id: string
          is_default: boolean
          kind: string
          label: string
          mask: string
          profile_id: string | null
          unit_id: string
        }
        Insert: {
          added_on?: string
          association_id: string
          created_at?: string
          detail?: Json
          id?: string
          is_default?: boolean
          kind: string
          label: string
          mask?: string
          profile_id?: string | null
          unit_id: string
        }
        Update: {
          added_on?: string
          association_id?: string
          created_at?: string
          detail?: Json
          id?: string
          is_default?: boolean
          kind?: string
          label?: string
          mask?: string
          profile_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_instruments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_instruments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_instruments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "payment_instruments_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
      payouts: {
        Row: {
          amount_cents: number
          approvals: Json
          approvals_required: number
          association_id: string
          created_at: string
          expected_on: string
          id: string
          invoice_number: string
          issued_on: string
          method: string
          status: string
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          amount_cents: number
          approvals?: Json
          approvals_required?: number
          association_id: string
          created_at?: string
          expected_on?: string
          id?: string
          invoice_number?: string
          issued_on?: string
          method?: string
          status?: string
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          amount_cents?: number
          approvals?: Json
          approvals_required?: number
          association_id?: string
          created_at?: string
          expected_on?: string
          id?: string
          invoice_number?: string
          issued_on?: string
          method?: string
          status?: string
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          liked_at: string
          post_id: string
          profile_id: string
        }
        Insert: {
          liked_at?: string
          post_id: string
          profile_id: string
        }
        Update: {
          liked_at?: string
          post_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_replies: {
        Row: {
          association_id: string
          author_id: string | null
          author_name: string
          author_role: string | null
          body: string
          created_at: string
          id: string
          post_id: string
          unit_label: string
        }
        Insert: {
          association_id: string
          author_id?: string | null
          author_name: string
          author_role?: string | null
          body: string
          created_at?: string
          id?: string
          post_id: string
          unit_label?: string
        }
        Update: {
          association_id?: string
          author_id?: string | null
          author_name?: string
          author_role?: string | null
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_replies_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          association_id: string
          author_id: string | null
          author_name: string
          author_role: string | null
          body: string
          category: string
          created_at: string
          id: string
          likes: number
          moderated_at: string | null
          moderated_by: string | null
          pinned: boolean
          rejection_reason: string | null
          status: Database["public"]["Enums"]["post_status"]
          title: string
          unit_label: string
        }
        Insert: {
          association_id: string
          author_id?: string | null
          author_name: string
          author_role?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          likes?: number
          moderated_at?: string | null
          moderated_by?: string | null
          pinned?: boolean
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          unit_label?: string
        }
        Update: {
          association_id?: string
          author_id?: string | null
          author_name?: string
          author_role?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          likes?: number
          moderated_at?: string | null
          moderated_by?: string | null
          pinned?: boolean
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          unit_label?: string
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
          attachments: Json
          body: string
          certificate_id: string | null
          created_at: string
          decided_by: string | null
          decided_note: string | null
          decided_on: string | null
          due_on: string | null
          due_reason: string | null
          filed_by: string | null
          id: string
          kind: Database["public"]["Enums"]["request_kind"]
          reference: string
          status: Database["public"]["Enums"]["request_status"]
          submission: Json | null
          submitted_on: string
          thread: Json
          title: string
          unit_id: string
          work_order: Json | null
        }
        Insert: {
          association_id: string
          attachments?: Json
          body?: string
          certificate_id?: string | null
          created_at?: string
          decided_by?: string | null
          decided_note?: string | null
          decided_on?: string | null
          due_on?: string | null
          due_reason?: string | null
          filed_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["request_kind"]
          reference: string
          status?: Database["public"]["Enums"]["request_status"]
          submission?: Json | null
          submitted_on?: string
          thread?: Json
          title: string
          unit_id: string
          work_order?: Json | null
        }
        Update: {
          association_id?: string
          attachments?: Json
          body?: string
          certificate_id?: string | null
          created_at?: string
          decided_by?: string | null
          decided_note?: string | null
          decided_on?: string | null
          due_on?: string | null
          due_reason?: string | null
          filed_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["request_kind"]
          reference?: string
          status?: Database["public"]["Enums"]["request_status"]
          submission?: Json | null
          submitted_on?: string
          thread?: Json
          title?: string
          unit_id?: string
          work_order?: Json | null
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
      reserve_components: {
        Row: {
          association_id: string
          created_at: string
          funded_cents: number
          id: string
          last_inspection: string | null
          name: string
          note: string | null
          remaining_life_years: number
          replacement_cost_cents: number
          useful_life_years: number
        }
        Insert: {
          association_id: string
          created_at?: string
          funded_cents?: number
          id?: string
          last_inspection?: string | null
          name: string
          note?: string | null
          remaining_life_years?: number
          replacement_cost_cents?: number
          useful_life_years?: number
        }
        Update: {
          association_id?: string
          created_at?: string
          funded_cents?: number
          id?: string
          last_inspection?: string | null
          name?: string
          note?: string | null
          remaining_life_years?: number
          replacement_cost_cents?: number
          useful_life_years?: number
        }
        Relationships: [
          {
            foreignKeyName: "reserve_components_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
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
      shared_cost_bills: {
        Row: {
          association_id: string
          created_at: string
          due_on: string
          id: string
          period_end: string
          period_start: string
          posted_at: string | null
          shared_cost_id: string
          total_cents: number
          usage_amount: number | null
          usage_unit: string
        }
        Insert: {
          association_id: string
          created_at?: string
          due_on: string
          id?: string
          period_end: string
          period_start: string
          posted_at?: string | null
          shared_cost_id: string
          total_cents: number
          usage_amount?: number | null
          usage_unit?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          due_on?: string
          id?: string
          period_end?: string
          period_start?: string
          posted_at?: string | null
          shared_cost_id?: string
          total_cents?: number
          usage_amount?: number | null
          usage_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_cost_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_cost_bills_shared_cost_id_fkey"
            columns: ["shared_cost_id"]
            isOneToOne: false
            referencedRelation: "shared_costs"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_cost_shares: {
        Row: {
          basis: number
          bill_id: string
          charge_id: string | null
          id: string
          share_cents: number
          unit_id: string
        }
        Insert: {
          basis?: number
          bill_id: string
          charge_id?: string | null
          id?: string
          share_cents: number
          unit_id: string
        }
        Update: {
          basis?: number
          bill_id?: string
          charge_id?: string | null
          id?: string
          share_cents?: number
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_cost_shares_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "shared_cost_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_cost_shares_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "shared_cost_history"
            referencedColumns: ["bill_id"]
          },
          {
            foreignKeyName: "shared_cost_shares_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_cost_shares_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "shared_cost_shares_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_costs: {
        Row: {
          account_ref: string
          active: boolean
          allocation: Database["public"]["Enums"]["allocation_method"]
          association_id: string
          created_at: string
          id: string
          kind: string
          markup_percent: number
          name: string
          provider: string
          usage_unit: string
        }
        Insert: {
          account_ref?: string
          active?: boolean
          allocation?: Database["public"]["Enums"]["allocation_method"]
          association_id: string
          created_at?: string
          id?: string
          kind?: string
          markup_percent?: number
          name: string
          provider?: string
          usage_unit?: string
        }
        Update: {
          account_ref?: string
          active?: boolean
          allocation?: Database["public"]["Enums"]["allocation_method"]
          association_id?: string
          created_at?: string
          id?: string
          kind?: string
          markup_percent?: number
          name?: string
          provider?: string
          usage_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_costs_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      special_assessments: {
        Row: {
          allocation: Database["public"]["Enums"]["allocation_method"]
          association_id: string
          ballot_id: string | null
          created_at: string
          first_due_on: string
          id: string
          installments: number
          levied_at: string | null
          reason: string
          title: string
          total_cents: number
        }
        Insert: {
          allocation?: Database["public"]["Enums"]["allocation_method"]
          association_id: string
          ballot_id?: string | null
          created_at?: string
          first_due_on: string
          id?: string
          installments?: number
          levied_at?: string | null
          reason?: string
          title: string
          total_cents: number
        }
        Update: {
          allocation?: Database["public"]["Enums"]["allocation_method"]
          association_id?: string
          ballot_id?: string | null
          created_at?: string
          first_due_on?: string
          id?: string
          installments?: number
          levied_at?: string | null
          reason?: string
          title?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "special_assessments_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "special_assessments_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballot_turnout"
            referencedColumns: ["ballot_id"]
          },
          {
            foreignKeyName: "special_assessments_ballot_id_fkey"
            columns: ["ballot_id"]
            isOneToOne: false
            referencedRelation: "ballots"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          association_id: string
          created_at: string
          id: string
          messages: Json
          participants: Json
          subject: string
          tag: string
          unit_id: string | null
          unread: boolean
          updated_on: string
        }
        Insert: {
          association_id: string
          created_at?: string
          id?: string
          messages?: Json
          participants?: Json
          subject: string
          tag?: string
          unit_id?: string | null
          unread?: boolean
          updated_on?: string
        }
        Update: {
          association_id?: string
          created_at?: string
          id?: string
          messages?: Json
          participants?: Json
          subject?: string
          tag?: string
          unit_id?: string | null
          unread?: boolean
          updated_on?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "threads_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          address: string
          association_id: string
          bedrooms: number | null
          created_at: string
          home_type: Database["public"]["Enums"]["property_type"] | null
          id: string
          label: string
          occupants: number | null
          square_feet: number | null
          stripe_customer_id: string | null
        }
        Insert: {
          address?: string
          association_id: string
          bedrooms?: number | null
          created_at?: string
          home_type?: Database["public"]["Enums"]["property_type"] | null
          id?: string
          label: string
          occupants?: number | null
          square_feet?: number | null
          stripe_customer_id?: string | null
        }
        Update: {
          address?: string
          association_id?: string
          bedrooms?: number | null
          created_at?: string
          home_type?: Database["public"]["Enums"]["property_type"] | null
          id?: string
          label?: string
          occupants?: number | null
          square_feet?: number | null
          stripe_customer_id?: string | null
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
      violation_reports: {
        Row: {
          association_id: string
          created_at: string
          dismissed_reason: string | null
          id: string
          observed_on: string
          reference: string
          reporter_name: string
          reporter_profile_id: string | null
          reporter_unit: string
          status: string
          subject_unit: string
          subject_unit_id: string | null
          submitted_on: string
          verification_note: string | null
          verified_by: string | null
          verified_on: string | null
          violation_id: string | null
          what: string
        }
        Insert: {
          association_id: string
          created_at?: string
          dismissed_reason?: string | null
          id?: string
          observed_on: string
          reference: string
          reporter_name?: string
          reporter_profile_id?: string | null
          reporter_unit?: string
          status?: string
          subject_unit: string
          subject_unit_id?: string | null
          submitted_on?: string
          verification_note?: string | null
          verified_by?: string | null
          verified_on?: string | null
          violation_id?: string | null
          what: string
        }
        Update: {
          association_id?: string
          created_at?: string
          dismissed_reason?: string | null
          id?: string
          observed_on?: string
          reference?: string
          reporter_name?: string
          reporter_profile_id?: string | null
          reporter_unit?: string
          status?: string
          subject_unit?: string
          subject_unit_id?: string | null
          submitted_on?: string
          verification_note?: string | null
          verified_by?: string | null
          verified_on?: string | null
          violation_id?: string | null
          what?: string
        }
        Relationships: [
          {
            foreignKeyName: "violation_reports_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violation_reports_subject_unit_id_fkey"
            columns: ["subject_unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "violation_reports_subject_unit_id_fkey"
            columns: ["subject_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      violations: {
        Row: {
          agency: string | null
          association_id: string
          case_number: string | null
          created_at: string
          fine_cents: number
          id: string
          next_action_on: string | null
          opened_on: string
          owner_fixed_note: string | null
          owner_fixed_on: string | null
          owner_name: string
          photos: Json
          reference: string
          report_id: string | null
          resolved_on: string | null
          rule: string
          rule_citation: string
          source: string
          stage: string
          unit_id: string | null
          unit_label: string
        }
        Insert: {
          agency?: string | null
          association_id: string
          case_number?: string | null
          created_at?: string
          fine_cents?: number
          id?: string
          next_action_on?: string | null
          opened_on?: string
          owner_fixed_note?: string | null
          owner_fixed_on?: string | null
          owner_name?: string
          photos?: Json
          reference: string
          report_id?: string | null
          resolved_on?: string | null
          rule: string
          rule_citation?: string
          source?: string
          stage?: string
          unit_id?: string | null
          unit_label?: string
        }
        Update: {
          agency?: string | null
          association_id?: string
          case_number?: string | null
          created_at?: string
          fine_cents?: number
          id?: string
          next_action_on?: string | null
          opened_on?: string
          owner_fixed_note?: string | null
          owner_fixed_on?: string | null
          owner_name?: string
          photos?: Json
          reference?: string
          report_id?: string | null
          resolved_on?: string | null
          rule?: string
          rule_citation?: string
          source?: string
          stage?: string
          unit_id?: string | null
          unit_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "violations_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "violation_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "unit_balances"
            referencedColumns: ["unit_id"]
          },
          {
            foreignKeyName: "violations_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
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
      monthly_activity: {
        Row: {
          association_id: string | null
          billed_cents: number | null
          category: Database["public"]["Enums"]["charge_category"] | null
          charge_count: number | null
          credited_cents: number | null
          month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_cost_history: {
        Row: {
          allocation: Database["public"]["Enums"]["allocation_method"] | null
          association_id: string | null
          average_share_cents: number | null
          bill_id: string | null
          homes: number | null
          name: string | null
          period_end: string | null
          period_start: string | null
          provider: string | null
          shared_cost_id: string | null
          total_cents: number | null
          usage_amount: number | null
          usage_unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_cost_bills_association_id_fkey"
            columns: ["association_id"]
            isOneToOne: false
            referencedRelation: "associations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_cost_bills_shared_cost_id_fkey"
            columns: ["shared_cost_id"]
            isOneToOne: false
            referencedRelation: "shared_costs"
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
      add_household: {
        Args: {
          p_association_id: string
          p_email: string
          p_name: string
          p_unit: string
          p_unit_id: string
        }
        Returns: string
      }
      allocate_cents: {
        Args: { p_basis: number[]; p_total_cents: number }
        Returns: number[]
      }
      association_by_join_code: {
        Args: { p_code: string }
        Returns: {
          city: string
          name: string
          state: string
        }[]
      }
      association_funds: { Args: { p_association_id: string }; Returns: Json }
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
      cast_votes: {
        Args: { p_ballot_id: string; p_option_ids: string[] }
        Returns: string
      }
      claim_my_seats: { Args: never; Returns: number }
      create_association: {
        Args: {
          p_city: string
          p_collects?: string[]
          p_due_day: number
          p_dues_by_type?: Json
          p_dues_cadence: Database["public"]["Enums"]["dues_cadence"]
          p_dues_cents: number
          p_founder_address?: string
          p_founder_home_type?: Database["public"]["Enums"]["property_type"]
          p_founder_name: string
          p_founder_unit: string
          p_home_types?: Database["public"]["Enums"]["property_type"][]
          p_households?: Json
          p_name: string
          p_origin?: Database["public"]["Enums"]["association_origin"]
          p_previously?: string
          p_property_type?: Database["public"]["Enums"]["property_type"]
          p_shared_spaces?: string[]
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
      home_history: {
        Args: { p_unit_id: string }
        Returns: {
          email: string
          ends_on: string
          full_name: string
          is_current: boolean
          starts_on: string
        }[]
      }
      is_board_of: { Args: { target: string }; Returns: boolean }
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
      levy_special_assessment: {
        Args: {
          p_allocation?: Database["public"]["Enums"]["allocation_method"]
          p_association_id: string
          p_ballot_id?: string
          p_first_due_on?: string
          p_installments?: number
          p_reason: string
          p_title: string
          p_total_cents: number
        }
        Returns: string
      }
      like_post: { Args: { p_post_id: string }; Returns: number }
      mark_violation_fixed: {
        Args: { p_note: string; p_violation_id: string }
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
      my_join_requests: {
        Args: never
        Returns: {
          association_id: string
          city: string
          created_at: string
          decided_on: string
          name: string
          state: string
          status: string
          unit_label: string
        }[]
      }
      my_unit_ids: { Args: never; Returns: string[] }
      owner_message: {
        Args: { p_body: string; p_unit_id: string }
        Returns: Json
      }
      post_shared_cost_bill: {
        Args: {
          p_due_on?: string
          p_period_end: string
          p_period_start: string
          p_readings?: Json
          p_shared_cost_id: string
          p_total_cents: number
          p_usage_amount?: number
          p_usage_unit?: string
        }
        Returns: string
      }
      record_payment: {
        Args: {
          p_amount_cents: number
          p_paid_by?: string
          p_platform_fee_cents?: number
          p_platform_fee_paid_by?: string
          p_processor_fee_cents?: number
          p_rail: Database["public"]["Enums"]["payment_rail"]
          p_stripe_payment_intent_id?: string
          p_unit_id: string
        }
        Returns: string
      }
      remove_household: { Args: { p_unit_id: string }; Returns: undefined }
      reply_as_owner: {
        Args: { p_body: string; p_thread_id: string }
        Returns: undefined
      }
      request_association_deletion: {
        Args: { p_association_id: string; p_typed_name: string }
        Returns: string
      }
      request_to_join: {
        Args: {
          p_code: string
          p_email: string
          p_name: string
          p_note: string
          p_unit: string
        }
        Returns: string
      }
      resume_subscription: {
        Args: { p_association_id: string }
        Returns: undefined
      }
      rsvp_meeting: {
        Args: { p_meeting_id: string; p_response: string }
        Returns: undefined
      }
      set_my_autopay: {
        Args: { p_association_id: string; p_autopay: Json }
        Returns: undefined
      }
      start_owner_thread: {
        Args: {
          p_body: string
          p_subject: string
          p_tag?: string
          p_unit_id: string
        }
        Returns: string
      }
      tables_without_rls: {
        Args: never
        Returns: {
          table_name: string
        }[]
      }
      transfer_home: {
        Args: {
          p_closing_date?: string
          p_new_email: string
          p_new_name: string
          p_unit_id: string
        }
        Returns: string
      }
      transfer_presidency: {
        Args: { p_to_profile: string }
        Returns: undefined
      }
      update_my_contact: {
        Args: {
          p_association_id: string
          p_mailing_address: string
          p_phone: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_kind: "operating" | "reserve" | "cd"
      allocation_method:
        | "equal"
        | "square_feet"
        | "bedrooms"
        | "occupants"
        | "submeter"
      association_origin:
        | "new"
        | "self-managed"
        | "leaving-manager"
        | "builder"
        | "handover"
        | "existing"
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
      charge_category:
        | "dues"
        | "special_assessment"
        | "shared_cost"
        | "late_fee"
        | "fine"
        | "other"
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
        | "billing"
        | "invite"
      payment_rail: "ach" | "card" | "apple-pay" | "google-pay"
      payment_state: "pending" | "settled" | "failed" | "refunded"
      post_status: "pending" | "published" | "rejected"
      property_type: "single-family" | "townhomes" | "condos"
      request_kind:
        | "maintenance"
        | "architectural"
        | "records"
        | "amenity"
        | "violation-appeal"
      request_status:
        | "submitted"
        | "in-review"
        | "approved"
        | "denied"
        | "closed"
        | "info-needed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      allocation_method: [
        "equal",
        "square_feet",
        "bedrooms",
        "occupants",
        "submeter",
      ],
      association_origin: [
        "new",
        "self-managed",
        "leaving-manager",
        "builder",
        "handover",
        "existing",
      ],
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
      charge_category: [
        "dues",
        "special_assessment",
        "shared_cost",
        "late_fee",
        "fine",
        "other",
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
        "billing",
        "invite",
      ],
      payment_rail: ["ach", "card", "apple-pay", "google-pay"],
      payment_state: ["pending", "settled", "failed", "refunded"],
      post_status: ["pending", "published", "rejected"],
      property_type: ["single-family", "townhomes", "condos"],
      request_kind: [
        "maintenance",
        "architectural",
        "records",
        "amenity",
        "violation-appeal",
      ],
      request_status: [
        "submitted",
        "in-review",
        "approved",
        "denied",
        "closed",
        "info-needed",
      ],
    },
  },
} as const
