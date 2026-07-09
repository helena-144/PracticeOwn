import { NextResponse } from "next/server";

import { logAuditEvent, getClientIp } from "@/lib/audit";
import { sendTransactionalEmail, upsertLoopsContact, LOOPS_TEMPLATES } from "@/lib/loops";
import { provisionPracticeForUser } from "@/lib/provision-practice";
import { createClient } from "@/lib/supabase/server";
import type { LicenseType } from "@/types/database";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const { user } = data;

  await logAuditEvent({
    userId: user.id,
    action: "LOGIN",
    ipAddress: getClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  const fullName = user.user_metadata.full_name as string | undefined;
  const licenseType = user.user_metadata.license_type as LicenseType | undefined;
  const state = user.user_metadata.state as string | undefined;

  // Only signup confirmations carry provisioning metadata; a password-reset
  // callback (for example) won't, and provisionPracticeForUser is a no-op if
  // the user already has a clinician record.
  if (fullName && licenseType && state) {
    const result = await provisionPracticeForUser(supabase, user, {
      fullName,
      licenseType,
      state,
    });

    if (!("error" in result)) {
      await upsertLoopsContact({
        email: user.email!,
        userId: user.id,
        firstName: fullName.split(" ")[0],
        organizationName: `${fullName}'s Practice`,
      }).catch(() => null);

      await sendTransactionalEmail({
        transactionalId: LOOPS_TEMPLATES.welcome,
        email: user.email!,
        dataVariables: { firstName: fullName.split(" ")[0] },
      }).catch(() => null);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
