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
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string | null
          resource: string | null
          resource_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          resource?: string | null
          resource_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          resource?: string | null
          resource_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          client_type: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          kyc_status: string | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_type?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kyc_status?: string | null
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_type?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kyc_status?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          body: string
          contract_type: string
          created_at: string
          created_by: string
          id: string
          inputs: Json
          language: string
          organization_id: string | null
          title: string
          updated_at: string
          status: string
          approved_body: string | null
          review_note: string | null
          reviewed_at: string | null
          kind: string
          reviewer_name: string | null
          reviewer_licence: string | null
          hidden_at: string | null
        }
        Insert: {
          kind?: string
          body?: string
          contract_type: string
          created_at?: string
          created_by?: string
          id?: string
          inputs?: Json
          language?: string
          organization_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          contract_type?: string
          created_at?: string
          created_by?: string
          id?: string
          inputs?: Json
          language?: string
          organization_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          jurisdiction: string | null
          organization_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          jurisdiction?: string | null
          organization_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          jurisdiction?: string | null
          organization_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          analysis: string | null
          created_at: string
          created_by: string | null
          extracted_text: string | null
          id: string
          matter: string | null
          mime_type: string | null
          name: string
          organization_id: string
          size_bytes: number | null
          storage_path: string
          updated_at: string
        }
        Insert: {
          analysis?: string | null
          created_at?: string
          created_by?: string | null
          extracted_text?: string | null
          id?: string
          matter?: string | null
          mime_type?: string | null
          name: string
          organization_id: string
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
        }
        Update: {
          analysis?: string | null
          created_at?: string
          created_by?: string | null
          extracted_text?: string | null
          id?: string
          matter?: string | null
          mime_type?: string | null
          name?: string
          organization_id?: string
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          organization_id: string
          position: string | null
          start_date: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          organization_id: string
          position?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          position?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hearings: {
        Row: {
          court: string | null
          created_at: string
          created_by: string | null
          hearing_date: string | null
          id: string
          location: string | null
          matter: string | null
          notes: string | null
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          court?: string | null
          created_at?: string
          created_by?: string | null
          hearing_date?: string | null
          id?: string
          location?: string | null
          matter?: string | null
          notes?: string | null
          organization_id: string
          title: string
          updated_at?: string
        }
        Update: {
          court?: string | null
          created_at?: string
          created_by?: string | null
          hearing_date?: string | null
          id?: string
          location?: string | null
          matter?: string | null
          notes?: string | null
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hearings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          error: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          error?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          client_name: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          due_date: string | null
          id: string
          number: string
          organization_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          number: string
          organization_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          due_date?: string | null
          id?: string
          number?: string
          organization_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          source: string | null
          stage: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          source?: string | null
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          created_by: string | null
          id: string
          jurisdiction: string | null
          organization_id: string
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction?: string | null
          organization_id: string
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          jurisdiction?: string | null
          organization_id?: string
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      matters: {
        Row: {
          client_name: string | null
          court: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          practice_area: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          court?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id: string
          practice_area?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          court?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          practice_area?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          created_at: string
          created_by: string
          default_language: string
          id: string
          jurisdictions: string[]
          name: string
          name_ar: string | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          created_by: string
          default_language?: string
          id?: string
          jurisdictions?: string[]
          name: string
          name_ar?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          created_at?: string
          created_by?: string
          default_language?: string
          id?: string
          jurisdictions?: string[]
          name?: string
          name_ar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"] | null
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          jurisdictions: string[]
          language: string
          numerals: string
          onboarded: boolean
          organization_id: string | null
          updated_at: string
          terms_version: string | null
          privacy_version: string | null
          consented_at: string | null
          ai_processing_consent: boolean
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          jurisdictions?: string[]
          language?: string
          numerals?: string
          onboarded?: boolean
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"] | null
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          jurisdictions?: string[]
          language?: string
          numerals?: string
          onboarded?: boolean
          organization_id?: string | null
          updated_at?: string
          terms_version?: string | null
          privacy_version?: string | null
          consented_at?: string | null
          ai_processing_consent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_emails: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          error: string | null
          id: string
          organization_id: string
          provider_id: string | null
          status: string
          subject: string | null
          to_address: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          organization_id: string
          provider_id?: string | null
          status?: string
          subject?: string | null
          to_address: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          id?: string
          organization_id?: string
          provider_id?: string | null
          status?: string
          subject?: string | null
          to_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "sent_emails_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          matter: string | null
          organization_id: string
          priority: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          matter?: string | null
          organization_id: string
          priority?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          matter?: string | null
          organization_id?: string
          priority?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          hours: number
          id: string
          matter: string | null
          organization_id: string
          rate: number | null
          updated_at: string
          work_date: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          hours?: number
          id?: string
          matter?: string | null
          organization_id: string
          rate?: number | null
          updated_at?: string
          work_date?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          hours?: number
          id?: string
          matter?: string | null
          organization_id?: string
          rate?: number | null
          updated_at?: string
          work_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_platform_admin: { Args: never; Returns: boolean }
      is_reviewer: { Args: never; Returns: boolean }
      platform_stats: { Args: never; Returns: Json }
      review_queue: {
        Args: never
        Returns: {
          id: string; created_by: string; kind: string; title: string; contract_type: string; language: string; inputs: Json
          body: string; status: string; approved_body: string | null; review_note: string | null
          reviewer_name: string | null; reviewer_licence: string | null
          reviewed_at: string | null; created_at: string; author_email: string | null
        }[]
      }
      review_contract: { Args: { _id: string; _decision: string; _body: string; _note: string }; Returns: undefined }
      hide_contract: { Args: { _id: string }; Returns: undefined }
      self_approve_contract: { Args: { _id: string }; Returns: undefined }
      is_verified_lawyer: { Args: { _uid?: string }; Returns: boolean }
      lawyer_applications: {
        Args: never
        Returns: {
          user_id: string; email: string | null; full_name: string; licence_no: string; licence_expiry: string | null
          phone: string | null; city: string | null; specialties: string[]; licence_file: string | null
          status: string; review_note: string | null; reviewed_at: string | null; created_at: string
        }[]
      }
      review_lawyer: { Args: { _user: string; _decision: string; _note: string }; Returns: undefined }
      delete_my_account: { Args: never; Returns: undefined }
      platform_stats_lawyers: { Args: never; Returns: Json }
      claim_invitations: { Args: never; Returns: number }
      current_org_id: { Args: never; Returns: string }
      has_org_role: {
        Args: {
          _org: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_portal_client: {
        Args: { _client_name: string; _org: string }
        Returns: boolean
      }
    }
    Enums: {
      account_type: "lawyer" | "law_firm" | "in_house" | "individual"
      app_role:
        | "owner"
        | "admin"
        | "lawyer"
        | "paralegal"
        | "accountant"
        | "client"
        | "viewer"
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
  public: {
    Enums: {
      account_type: ["lawyer", "law_firm", "in_house", "individual"],
      app_role: [
        "owner",
        "admin",
        "lawyer",
        "paralegal",
        "accountant",
        "client",
        "viewer",
      ],
    },
  },
} as const
