import type { Tables } from "@/types/database";

export type Practice = Tables<"practices">;
export type Clinician = Tables<"clinicians">;
export type Alert = Tables<"alerts">;
export type Credential = Tables<"credentials">;
export type PayerEnrollment = Tables<"payer_enrollments">;
export type IndependenceScoreRecord = Tables<"independence_scores">;
export type RoadmapStep = Tables<"roadmap_steps">;
