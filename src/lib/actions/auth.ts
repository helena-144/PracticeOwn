"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { getClientIp, logAuditEvent } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs the current user out, logs a LOGOUT audit event via the service
 * role, clears the session cookies, and redirects to /login. Invoked from a
 * plain <form action={signOutAction}> so it works without client JS.
 */
export async function signOutAction(): Promise<void> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const headerList = headers();

  if (user) {
    await logAuditEvent({
      userId: user.id,
      action: "LOGOUT",
      ipAddress: getClientIp(headerList),
      userAgent: headerList.get("user-agent"),
    });
  }

  await supabase.auth.signOut();
  cookies().delete("pw_last_activity");

  redirect("/login");
}
