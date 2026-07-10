/**
 * Hand-authored to mirror the shape produced by `supabase gen types typescript`,
 * matching supabase/migrations/001_initial_schema.sql and
 * supabase/migrations/002_onboarding_wizard.sql.
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

export type PracticePlan = "trial" | "solo" | "group" | "enterprise";

export type LicenseType = "LCSW" | "LPC" | "LMFT" | "PhD" | "PsyD" | "MD" | "NP" | "Other";

export type PracticeType = "solo" | "small_group" | "group";

export type PlatformSlug =
  | "headway"
  | "grow_therapy"
  | "alma"
  | "simple_practice"
  | "therapy_notes"
  | "theranest"
  | "none"
  | "other";

export type NpiStatus = "yes" | "no" | "unknown";

export type GroupNpiStatus = "yes" | "no" | "not_applicable";

export type CaqhStatus = "practice_controlled" | "platform_managed" | "no" | "unknown";

export type CredentialType =
  | "license"
  | "malpractice"
  | "dea"
  | "caqh"
  | "npi"
  | "payer_enrollment"
  | "other";

export type CredentialStatus = "active" | "expiring_soon" | "expired" | "pending" | "unknown";

export type PayerEnrollmentType = "direct" | "headway" | "grow_therapy" | "alma" | "other_platform";

export type PayerContractOwner = "practice" | "platform" | "unknown";

export type PayerNpiUsed = "individual" | "group" | "platform";

export type PayerEnrollmentStatus =
  | "pending"
  | "submitted"
  | "in_review"
  | "active"
  | "inactive"
  | "denied"
  | "reattesting";

export type AlertType =
  | "caqh_attestation"
  | "license_expiry"
  | "malpractice_expiry"
  | "dea_expiry"
  | "payer_reattestion"
  | "document_missing"
  | "score_drop"
  | "other";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

export type RoadmapModule = "ownership" | "credentials" | "independence" | "exit_planner" | "documentation";

export type RoadmapPriority = "low" | "medium" | "high" | "critical";

export type AuditAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "SELECT_PHI"
  | "LOGIN"
  | "LOGOUT"
  | "FILE_ACCESS"
  | "EXPORT";

export interface IndependenceScoreBreakdown {
  individual_npi: { points: number; max: number; met: boolean };
  caqh_practice_controlled: { points: number; max: number; met: boolean };
  caqh_attestation_current: { points: number; max: number; met: boolean };
  direct_payer_contracts: { points: number; max: number; active_direct_contracts: number };
  license_current: { points: number; max: number; met: boolean };
  malpractice_current: { points: number; max: number; met: boolean };
  no_critical_alerts: { points: number; max: number; met: boolean };
}

export interface Database {
  public: {
    Tables: {
      practices: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          state: string;
          plan: PracticePlan;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_status: string | null;
          trial_ends_at: string | null;
          independence_score: number;
          practice_type: PracticeType | null;
          years_in_practice: number | null;
          current_platforms: PlatformSlug[];
          platforms_other_detail: string | null;
          onboarding_step: number;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          state: string;
          plan?: PracticePlan;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_status?: string | null;
          trial_ends_at?: string | null;
          independence_score?: number;
          practice_type?: PracticeType | null;
          years_in_practice?: number | null;
          current_platforms?: PlatformSlug[];
          platforms_other_detail?: string | null;
          onboarding_step?: number;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["practices"]["Insert"]>;
        Relationships: [];
      };
      clinicians: {
        Row: {
          id: string;
          practice_id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          email: string;
          license_type: LicenseType;
          npi_individual: string | null;
          npi_group: string | null;
          caqh_id: string | null;
          caqh_username_encrypted: string | null;
          caqh_last_attested_at: string | null;
          caqh_next_attestation_due: string | null;
          has_individual_npi: NpiStatus | null;
          has_group_npi: GroupNpiStatus | null;
          caqh_status: CaqhStatus | null;
          is_primary_clinician: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          practice_id: string;
          user_id?: string | null;
          first_name: string;
          last_name: string;
          email: string;
          license_type: LicenseType;
          npi_individual?: string | null;
          npi_group?: string | null;
          caqh_id?: string | null;
          caqh_last_attested_at?: string | null;
          has_individual_npi?: NpiStatus | null;
          has_group_npi?: GroupNpiStatus | null;
          caqh_status?: CaqhStatus | null;
          is_primary_clinician?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clinicians"]["Insert"]>;
        Relationships: [];
      };
      credentials: {
        Row: {
          id: string;
          clinician_id: string;
          practice_id: string;
          type: CredentialType;
          name: string;
          issuing_body: string | null;
          credential_number: string | null;
          issue_date: string | null;
          expiry_date: string | null;
          renewal_date: string | null;
          status: CredentialStatus;
          document_path: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinician_id: string;
          practice_id: string;
          type: CredentialType;
          name: string;
          issuing_body?: string | null;
          credential_number?: string | null;
          issue_date?: string | null;
          expiry_date?: string | null;
          renewal_date?: string | null;
          status?: CredentialStatus;
          document_path?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["credentials"]["Insert"]>;
        Relationships: [];
      };
      payer_enrollments: {
        Row: {
          id: string;
          clinician_id: string;
          practice_id: string;
          payer_name: string;
          payer_id: string | null;
          enrollment_type: PayerEnrollmentType;
          contract_owner: PayerContractOwner | null;
          npi_used: PayerNpiUsed | null;
          status: PayerEnrollmentStatus;
          submitted_at: string | null;
          approved_at: string | null;
          reattestion_due_at: string | null;
          monthly_rate_cents: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinician_id: string;
          practice_id: string;
          payer_name: string;
          payer_id?: string | null;
          enrollment_type: PayerEnrollmentType;
          contract_owner?: PayerContractOwner | null;
          npi_used?: PayerNpiUsed | null;
          status?: PayerEnrollmentStatus;
          submitted_at?: string | null;
          approved_at?: string | null;
          reattestion_due_at?: string | null;
          monthly_rate_cents?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payer_enrollments"]["Insert"]>;
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          practice_id: string;
          clinician_id: string;
          credential_id: string | null;
          payer_enrollment_id: string | null;
          file_name: string;
          file_path: string;
          file_type: string | null;
          file_size_bytes: number | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          practice_id: string;
          clinician_id: string;
          credential_id?: string | null;
          payer_enrollment_id?: string | null;
          file_name: string;
          file_path: string;
          file_type?: string | null;
          file_size_bytes?: number | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          practice_id: string;
          clinician_id: string | null;
          credential_id: string | null;
          payer_enrollment_id: string | null;
          type: AlertType;
          severity: AlertSeverity;
          title: string;
          description: string | null;
          due_date: string | null;
          is_read: boolean;
          is_dismissed: boolean;
          email_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          practice_id: string;
          clinician_id?: string | null;
          credential_id?: string | null;
          payer_enrollment_id?: string | null;
          type: AlertType;
          severity?: AlertSeverity;
          title: string;
          description?: string | null;
          due_date?: string | null;
          is_read?: boolean;
          is_dismissed?: boolean;
          email_sent_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["alerts"]["Insert"]>;
        Relationships: [];
      };
      independence_scores: {
        Row: {
          id: string;
          practice_id: string;
          score: number;
          score_breakdown: Json;
          computed_at: string;
        };
        Insert: {
          id?: string;
          practice_id: string;
          score: number;
          score_breakdown: Json;
          computed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["independence_scores"]["Insert"]>;
        Relationships: [];
      };
      roadmap_steps: {
        Row: {
          id: string;
          practice_id: string;
          module: RoadmapModule;
          step_number: number;
          title: string;
          description: string | null;
          action_url: string | null;
          is_completed: boolean;
          completed_at: string | null;
          priority: RoadmapPriority;
          due_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          practice_id: string;
          module: RoadmapModule;
          step_number: number;
          title: string;
          description?: string | null;
          action_url?: string | null;
          is_completed?: boolean;
          completed_at?: string | null;
          priority?: RoadmapPriority;
          due_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["roadmap_steps"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          user_id: string | null;
          practice_id: string | null;
          action: AuditAction;
          table_name: string | null;
          row_id: string | null;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          practice_id?: string | null;
          action: AuditAction;
          table_name?: string | null;
          row_id?: string | null;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      set_clinician_caqh_username: {
        Args: { p_clinician_id: string; p_username: string };
        Returns: undefined;
      };
      get_clinician_caqh_username: {
        Args: { p_clinician_id: string };
        Returns: string | null;
      };
      is_practice_member: {
        Args: { p_practice_id: string };
        Returns: boolean;
      };
      is_practice_owner: {
        Args: { p_practice_id: string };
        Returns: boolean;
      };
      recalculate_independence_score: {
        Args: { p_practice_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
