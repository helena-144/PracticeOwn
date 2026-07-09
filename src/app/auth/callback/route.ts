import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { upsertLoopsContact, sendTransactionalEmail, LOOPS_TEMPLATES } from "@/lib/loops";

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

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const fullName = (user.user_metadata.full_name as string | undefined) ?? null;
    const practiceName =
      (user.user_metadata.practice_name as string | undefined) ?? "My Practice";

    const { data: organization } = await supabase
      .from("organizations")
      .insert({ name: practiceName, owner_id: user.id })
      .select("id")
      .single();

    await supabase.from("profiles").insert({
      id: user.id,
      email: user.email!,
      full_name: fullName,
      organization_id: organization?.id ?? null,
      role: "owner",
    });

    await upsertLoopsContact({
      email: user.email!,
      userId: user.id,
      firstName: fullName?.split(" ")[0],
      organizationName: practiceName,
    }).catch(() => null);

    await sendTransactionalEmail({
      transactionalId: LOOPS_TEMPLATES.welcome,
      email: user.email!,
      dataVariables: { firstName: fullName ?? "there", practiceName },
    }).catch(() => null);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
