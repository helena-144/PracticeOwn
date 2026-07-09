import type { CredentialStatus, CredentialType, Tables } from "@/types/database";

export type Credential = Tables<"credentials">;

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  medical_license: "Medical License",
  dea_registration: "DEA Registration",
  board_certification: "Board Certification",
  malpractice_insurance: "Malpractice Insurance",
  npi: "NPI",
  cds_registration: "CDS Registration",
  hospital_privileges: "Hospital Privileges",
  cme: "Continuing Medical Education",
  other: "Other",
};

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  pending_renewal: "Pending Renewal",
};

export interface CredentialFormValues {
  provider_name: string;
  credential_type: CredentialType;
  issuing_body: string;
  credential_number: string;
  issue_date: string;
  expiration_date: string;
  reminder_days_before: number;
}

export interface CredentialWithComputedStatus extends Credential {
  daysUntilExpiration: number | null;
}

export function computeCredentialStatus(expirationDate: string | null): CredentialStatus {
  if (!expirationDate) return "active";

  const now = new Date();
  const expiry = new Date(expirationDate);
  const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntil < 0) return "expired";
  if (daysUntil <= 60) return "expiring_soon";
  return "active";
}

export function daysUntilExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null;
  const now = new Date();
  const expiry = new Date(expirationDate);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
