import type { CredentialStatus, CredentialType, Tables } from "@/types/database";

export type Credential = Tables<"credentials">;

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  license: "License",
  malpractice: "Malpractice Insurance",
  dea: "DEA Registration",
  caqh: "CAQH",
  npi: "NPI",
  payer_enrollment: "Payer Enrollment",
  other: "Other",
};

export const CREDENTIAL_STATUS_LABELS: Record<CredentialStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  pending: "Pending",
  unknown: "Unknown",
};

export interface CredentialFormValues {
  clinician_id: string;
  type: CredentialType;
  name: string;
  issuing_body: string;
  credential_number: string;
  issue_date: string;
  expiry_date: string;
}

export function daysUntilExpiration(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
