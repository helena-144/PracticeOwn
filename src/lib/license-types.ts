import type { LicenseType } from "@/types/database";

export interface LicenseTypeOption {
  value: LicenseType;
  label: string;
}

export const LICENSE_TYPES: LicenseTypeOption[] = [
  { value: "LCSW", label: "LCSW — Licensed Clinical Social Worker" },
  { value: "LPC", label: "LPC — Licensed Professional Counselor" },
  { value: "LMFT", label: "LMFT — Licensed Marriage & Family Therapist" },
  { value: "PhD", label: "PhD — Doctor of Philosophy" },
  { value: "PsyD", label: "PsyD — Doctor of Psychology" },
  { value: "MD", label: "MD — Doctor of Medicine" },
  { value: "NP", label: "NP — Nurse Practitioner" },
  { value: "Other", label: "Other" },
];
