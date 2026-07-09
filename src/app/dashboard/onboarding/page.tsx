import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { OnboardingForm } from "@/components/forms/onboarding-form";
import { createClient } from "@/lib/supabase/server";

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

  const { data: clinician } = await supabase
    .from("clinicians")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (clinician) {
    redirect("/dashboard");
  }

  return <OnboardingForm />;
}
