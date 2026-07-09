import type { Clinician, Credential, PayerEnrollment, Practice } from "@/types/practice";

export interface WizardData {
  practice: Practice;
  clinician: Clinician;
  credentials: Credential[];
  payerEnrollments: PayerEnrollment[];
}

export interface StepProps {
  data: WizardData;
  /** Re-fetches practice/clinician/credentials/payerEnrollments from Supabase and updates wizard state. */
  refresh: () => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}
