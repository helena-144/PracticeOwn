import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { provisionPracticeForUser } from "@/lib/provision-practice";
import { createClient } from "@/lib/supabase/server";
import type { LicenseType } from "@/types/database";

export const metadata: Metadata = {
  title: "Set up your practice | PracticeOwn",
};

export default async function OnboardingPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let { data: clinician } = await supabase
    .from("clinicians")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Safety net: signup and the auth callback both provision a practice +
  // clinician already, so this should be rare — but if it somehow didn't
  // happen (e.g. an account created outside the normal signup flow), provision
  // a starting point here from whatever signup metadata is available so the
  // wizard has a practice/clinician row to save progress against.
  if (!clinician) {
    const fullName =
      (user.user_metadata.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "New Clinician";
    const licenseType = (user.user_metadata.license_type as LicenseType | undefined) ?? "Other";
    const state = (user.user_metadata.state as string | undefined) ?? "CA";

    const result = await provisionPracticeForUser(supabase, user, { fullName, licenseType, state });

    if ("error" in result) {
      throw new Error(`Could not set up your account: ${result.error}`);
    }

    const { data: refetchedClinician } = await supabase
      .from("clinicians")
      .select("*")
      .eq("id", result.clinicianId)
      .single();
    clinician = refetchedClinician;
  }

  if (!clinician) {
    throw new Error("Could not load your clinician record");
  }

  const { data: practice } = await supabase
    .from("practices")
    .select("*")
    .eq("id", clinician.practice_id)
    .single();

  if (!practice) {
    throw new Error("Could not load your practice");
  }

  if (practice.onboarding_completed_at) {
    redirect("/dashboard");
  }

  const [{ data: credentials }, { data: payerEnrollments }] = await Promise.all([
    supabase.from("credentials").select("*").eq("clinician_id", clinician.id),
    supabase.from("payer_enrollments").select("*").eq("clinician_id", clinician.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Set up your practice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A few quick steps to calculate your independence score. Your progress is saved
          automatically — close this any time and pick up where you left off.
        </p>
      </div>
      <OnboardingWizard
        initialData={{
          practice,
          clinician,
          credentials: credentials ?? [],
          payerEnrollments: payerEnrollments ?? [],
        }}
      />
    </div>
  );
}
