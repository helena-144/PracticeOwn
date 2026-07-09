import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { Database, LicenseType } from "@/types/database";

export interface ProvisionPracticeParams {
  fullName: string;
  licenseType: LicenseType;
  state: string;
}

export interface ProvisionPracticeResult {
  practiceId: string;
  clinicianId: string;
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const [firstName, ...rest] = parts;
  return { firstName, lastName: rest.join(" ") };
}

/**
 * Idempotently creates a practice + primary clinician record for a freshly
 * authenticated user. Safe to call multiple times (e.g. once optimistically
 * after signup, once again in the auth callback) — it no-ops if the user is
 * already linked to a clinician.
 *
 * Runs against the caller's own RLS-scoped client (not the service role) so
 * the `practices_insert` policy's `owner_id = auth.uid()` check applies
 * naturally.
 */
export async function provisionPracticeForUser(
  supabase: SupabaseClient<Database>,
  user: User,
  params: ProvisionPracticeParams
): Promise<ProvisionPracticeResult | { error: string }> {
  const { data: existingClinician, error: lookupError } = await supabase
    .from("clinicians")
    .select("id, practice_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError.message };
  }

  if (existingClinician) {
    return { practiceId: existingClinician.practice_id, clinicianId: existingClinician.id };
  }

  if (!user.email) {
    return { error: "Account has no email address on file" };
  }

  const { firstName, lastName } = splitFullName(params.fullName);

  const { data: practice, error: practiceError } = await supabase
    .from("practices")
    .insert({
      owner_id: user.id,
      name: `${params.fullName}'s Practice`,
      state: params.state,
    })
    .select("id")
    .single();

  if (practiceError || !practice) {
    return { error: practiceError?.message ?? "Failed to create practice" };
  }

  const { data: clinician, error: clinicianError } = await supabase
    .from("clinicians")
    .insert({
      practice_id: practice.id,
      user_id: user.id,
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      license_type: params.licenseType,
      is_primary_clinician: true,
    })
    .select("id")
    .single();

  if (clinicianError || !clinician) {
    return { error: clinicianError?.message ?? "Failed to create clinician record" };
  }

  return { practiceId: practice.id, clinicianId: clinician.id };
}
