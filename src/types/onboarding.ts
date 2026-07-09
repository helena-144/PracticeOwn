import { z } from "zod";

import type {
  CredentialType,
  LicenseType,
  PayerEnrollmentType,
  PlatformSlug,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Step 1 — Practice Setup
// ---------------------------------------------------------------------------

export const practiceSetupSchema = z
  .object({
    practiceName: z.string().min(1, "Practice name is required"),
    state: z.string().min(1, "Select a state"),
    practiceType: z.enum(["solo", "small_group", "group"], {
      message: "Select a practice type",
    }),
    yearsInPractice: z.coerce
      .number({ message: "Enter a number" })
      .int("Enter a whole number")
      .min(0, "Must be 0 or more")
      .max(70, "That doesn't look right"),
    platforms: z.array(z.custom<PlatformSlug>()).min(1, "Select at least one option"),
    platformsOtherDetail: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.platforms.includes("other") && !data.platformsOtherDetail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tell us which platform",
        path: ["platformsOtherDetail"],
      });
    }
  });

export type PracticeSetupValues = z.infer<typeof practiceSetupSchema>;

// ---------------------------------------------------------------------------
// Step 2 — NPI & CAQH
// ---------------------------------------------------------------------------

const npiPattern = /^\d{10}$/;

export const npiCaqhSchema = z
  .object({
    hasIndividualNpi: z.enum(["yes", "no", "unknown"], {
      message: "Select an option",
    }),
    individualNpi: z.string().optional(),
    hasGroupNpi: z.enum(["yes", "no", "not_applicable"], {
      message: "Select an option",
    }),
    groupNpi: z.string().optional(),
    caqhStatus: z.enum(["practice_controlled", "platform_managed", "no", "unknown"], {
      message: "Select an option",
    }),
    caqhId: z.string().optional(),
    caqhLastAttestedAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasIndividualNpi === "yes" && !npiPattern.test(data.individualNpi ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid 10-digit NPI",
        path: ["individualNpi"],
      });
    }
    if (data.hasGroupNpi === "yes" && !npiPattern.test(data.groupNpi ?? "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid 10-digit NPI",
        path: ["groupNpi"],
      });
    }
    if (data.caqhStatus === "practice_controlled" && !data.caqhId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter your CAQH ID",
        path: ["caqhId"],
      });
    }
  });

export type NpiCaqhValues = z.infer<typeof npiCaqhSchema>;

// ---------------------------------------------------------------------------
// Step 3 — Credentials
// ---------------------------------------------------------------------------

export const additionalCredentialSchema = z.object({
  id: z.string(),
  type: z.custom<CredentialType>((val) => typeof val === "string" && val.length > 0, {
    message: "Select a type",
  }),
  name: z.string().min(1, "Name is required"),
  issuingBody: z.string().optional(),
  credentialNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

export type AdditionalCredentialValues = z.infer<typeof additionalCredentialSchema>;

export const credentialsStepSchema = z
  .object({
    license: z.object({
      licenseType: z.custom<LicenseType>((val) => typeof val === "string" && val.length > 0, {
        message: "Select a license type",
      }),
      state: z.string().min(1, "Select a state"),
      licenseNumber: z.string().min(1, "License number is required"),
      expiryDate: z.string().min(1, "Expiration date is required"),
    }),
    malpractice: z.object({
      carrierName: z.string().min(1, "Carrier name is required"),
      policyNumber: z.string().min(1, "Policy number is required"),
      expiryDate: z.string().min(1, "Expiration date is required"),
    }),
    hasDea: z.enum(["yes", "no"], { message: "Select an option" }),
    dea: z.object({
      deaNumber: z.string().optional(),
      expiryDate: z.string().optional(),
    }),
    additionalCredentials: z.array(additionalCredentialSchema),
  })
  .superRefine((data, ctx) => {
    if (data.hasDea === "yes") {
      if (!data.dea.deaNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DEA number is required",
          path: ["dea", "deaNumber"],
        });
      }
      if (!data.dea.expiryDate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expiration date is required",
          path: ["dea", "expiryDate"],
        });
      }
    }
  });

export type CredentialsStepValues = z.infer<typeof credentialsStepSchema>;

// ---------------------------------------------------------------------------
// Step 4 — Payer Enrollments
// ---------------------------------------------------------------------------

export const payerEnrollmentEntrySchema = z.object({
  id: z.string(),
  payerName: z.string().min(1, "Select or enter a payer"),
  enrollmentType: z.custom<PayerEnrollmentType>((val) => typeof val === "string" && val.length > 0, {
    message: "Select an enrollment type",
  }),
  status: z.enum(["active", "pending", "inactive"], { message: "Select a status" }),
});

export type PayerEnrollmentEntryValues = z.infer<typeof payerEnrollmentEntrySchema>;

export const payerEnrollmentsStepSchema = z.object({
  enrollments: z.array(payerEnrollmentEntrySchema),
});

export type PayerEnrollmentsStepValues = z.infer<typeof payerEnrollmentsStepSchema>;

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export const ENROLLMENT_TYPE_LABELS: Record<PayerEnrollmentType, string> = {
  direct: "Direct contract under my practice",
  headway: "Through Headway",
  grow_therapy: "Through Grow Therapy",
  alma: "Through Alma",
  other_platform: "Through other platform",
};

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
