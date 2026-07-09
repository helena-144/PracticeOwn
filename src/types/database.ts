/**
 * Hand-authored to mirror the shape produced by `supabase gen types typescript`.
 * Regenerate from the live schema with:
 *   supabase gen types typescript --project-id <project-ref> > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CredentialType =
  | "medical_license"
  | "dea_registration"
  | "board_certification"
  | "malpractice_insurance"
  | "npi"
  | "cds_registration"
  | "hospital_privileges"
  | "cme"
  | "other";

export type CredentialStatus = "active" | "expiring_soon" | "expired" | "pending_renewal";

export type OwnershipEntityType =
  | "physician"
  | "private_equity"
  | "mso"
  | "hospital_system"
  | "other_investor";

export type ExitType = "sale" | "succession" | "merger" | "retirement" | "recapitalization";

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertType =
  | "credential_expiring"
  | "credential_expired"
  | "ownership_compliance"
  | "independence_score_drop"
  | "exit_milestone"
  | "billing";

export type SubscriptionPlan = "solo" | "group";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

export type OrgRole = "owner" | "admin" | "staff";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          npi: string | null;
          tax_id: string | null;
          specialty: string | null;
          state: string | null;
          owner_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_plan: SubscriptionPlan | null;
          subscription_status: SubscriptionStatus | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          npi?: string | null;
          tax_id?: string | null;
          specialty?: string | null;
          state?: string | null;
          owner_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_plan?: SubscriptionPlan | null;
          subscription_status?: SubscriptionStatus | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string | null;
          full_name: string | null;
          email: string;
          role: OrgRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id?: string | null;
          full_name?: string | null;
          email: string;
          role?: OrgRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      credentials: {
        Row: {
          id: string;
          organization_id: string;
          provider_name: string;
          credential_type: CredentialType;
          issuing_body: string | null;
          credential_number: string | null;
          issue_date: string | null;
          expiration_date: string | null;
          status: CredentialStatus;
          document_path: string | null;
          reminder_days_before: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          provider_name: string;
          credential_type: CredentialType;
          issuing_body?: string | null;
          credential_number?: string | null;
          issue_date?: string | null;
          expiration_date?: string | null;
          status?: CredentialStatus;
          document_path?: string | null;
          reminder_days_before?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["credentials"]["Insert"]>;
        Relationships: [];
      };
      ownership_records: {
        Row: {
          id: string;
          organization_id: string;
          owner_name: string;
          entity_type: OwnershipEntityType;
          ownership_percentage: number;
          effective_date: string;
          cpom_compliant: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          owner_name: string;
          entity_type: OwnershipEntityType;
          ownership_percentage: number;
          effective_date: string;
          cpom_compliant?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ownership_records"]["Insert"]>;
        Relationships: [];
      };
      independence_scores: {
        Row: {
          id: string;
          organization_id: string;
          score: number;
          category_scores: Json;
          factors: Json;
          calculated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          score: number;
          category_scores?: Json;
          factors?: Json;
          calculated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["independence_scores"]["Insert"]>;
        Relationships: [];
      };
      exit_plans: {
        Row: {
          id: string;
          organization_id: string;
          exit_type: ExitType;
          target_exit_date: string | null;
          valuation_estimate_cents: number | null;
          readiness_score: number;
          milestones: Json;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          exit_type: ExitType;
          target_exit_date?: string | null;
          valuation_estimate_cents?: number | null;
          readiness_score?: number;
          milestones?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["exit_plans"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          category: string | null;
          storage_path: string;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          category?: string | null;
          storage_path: string;
          uploaded_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      qa_threads: {
        Row: {
          id: string;
          organization_id: string;
          document_id: string | null;
          question: string;
          answer: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          document_id?: string | null;
          question: string;
          answer?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["qa_threads"]["Insert"]>;
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          organization_id: string;
          type: AlertType;
          severity: AlertSeverity;
          title: string;
          message: string;
          related_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          type: AlertType;
          severity?: AlertSeverity;
          title: string;
          message: string;
          related_id?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
