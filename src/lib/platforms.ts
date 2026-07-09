import type { PlatformSlug } from "@/types/database";

export interface PlatformOption {
  value: PlatformSlug;
  label: string;
}

export const PLATFORMS: PlatformOption[] = [
  { value: "headway", label: "Headway" },
  { value: "grow_therapy", label: "Grow Therapy" },
  { value: "alma", label: "Alma" },
  { value: "simple_practice", label: "SimplePractice" },
  { value: "therapy_notes", label: "TherapyNotes" },
  { value: "theranest", label: "TheraNest" },
  { value: "none", label: "None of these" },
  { value: "other", label: "Other" },
];

export const PRACTICE_TYPES: { value: "solo" | "small_group" | "group"; label: string }[] = [
  { value: "solo", label: "Solo (just me)" },
  { value: "small_group", label: "Small Group (2–5 clinicians)" },
  { value: "group", label: "Group (6–15 clinicians)" },
];
