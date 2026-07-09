import type {
  ExitType,
  Json,
  OrgRole,
  OwnershipEntityType,
  SubscriptionPlan,
  SubscriptionStatus,
  Tables,
} from "@/types/database";

export type Organization = Tables<"organizations">;
export type Profile = Tables<"profiles">;
export type OwnershipRecord = Tables<"ownership_records">;
export type IndependenceScoreRecord = Tables<"independence_scores">;
export type ExitPlan = Tables<"exit_plans">;
export type Document = Tables<"documents">;
export type QaThread = Tables<"qa_threads">;
export type Alert = Tables<"alerts">;

export interface OrganizationWithOwner extends Organization {
  owner: Profile;
}

export interface OwnershipSummary {
  totalPhysicianOwnership: number;
  totalOutsideOwnership: number;
  isCpomCompliant: boolean;
  records: OwnershipRecord[];
}

export interface IndependenceCategoryScores {
  financialControl: number;
  clinicalAutonomy: number;
  operationalControl: number;
  contractualObligations: number;
  ownershipStructure: number;
}

export interface IndependenceFactor {
  category: keyof IndependenceCategoryScores;
  label: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
  description: string;
}

export interface IndependenceScoreDetail extends Omit<IndependenceScoreRecord, "category_scores" | "factors"> {
  category_scores: IndependenceCategoryScores;
  factors: IndependenceFactor[];
}

export interface ExitMilestone {
  id: string;
  label: string;
  completed: boolean;
  dueDate: string | null;
}

export interface ExitPlanDetail extends Omit<ExitPlan, "milestones"> {
  milestones: ExitMilestone[];
}

export function parseExitMilestones(milestones: Json): ExitMilestone[] {
  if (!Array.isArray(milestones)) return [];
  return milestones as unknown as ExitMilestone[];
}

export function parseIndependenceCategoryScores(scores: Json): IndependenceCategoryScores {
  const defaults: IndependenceCategoryScores = {
    financialControl: 0,
    clinicalAutonomy: 0,
    operationalControl: 0,
    contractualObligations: 0,
    ownershipStructure: 0,
  };
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) return defaults;
  return { ...defaults, ...(scores as Partial<IndependenceCategoryScores>) };
}

export interface BillingPlanOption {
  id: SubscriptionPlan;
  name: string;
  priceId: string;
  priceLabel: string;
  description: string;
  features: string[];
}

export interface BillingState {
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  stripeCustomerId: string | null;
  currentPeriodEnd: string | null;
}

export const ORG_ROLES: OrgRole[] = ["owner", "admin", "staff"];
export const OWNERSHIP_ENTITY_TYPES: OwnershipEntityType[] = [
  "physician",
  "private_equity",
  "mso",
  "hospital_system",
  "other_investor",
];
export const EXIT_TYPES: ExitType[] = [
  "sale",
  "succession",
  "merger",
  "retirement",
  "recapitalization",
];
