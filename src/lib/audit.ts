import { createClient } from "@supabase/supabase-js";

import type { AuditAction, Database } from "@/types/database";

/**
 * Stateless service-role client for writing to audit_log. Deliberately built
 * on the plain @supabase/supabase-js client (not @supabase/ssr) since audit
 * writes carry no user session/cookies — just the service-role API key. Safe
 * to call from Edge middleware, Route Handlers, or Server Actions.
 */
function getAuditServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export interface AuditEventInput {
  userId: string | null;
  practiceId?: string | null;
  action: AuditAction;
  tableName?: string | null;
  rowId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Writes a row to audit_log via the service role, bypassing RLS. Never
 * throws — a failed audit write is logged to the server console but must
 * not block the auth flow that triggered it.
 */
export async function logAuditEvent(event: AuditEventInput): Promise<void> {
  try {
    const supabase = getAuditServiceClient();
    const { error } = await supabase.from("audit_log").insert({
      user_id: event.userId,
      practice_id: event.practiceId ?? null,
      action: event.action,
      table_name: event.tableName ?? null,
      row_id: event.rowId ?? null,
      ip_address: event.ipAddress ?? null,
      user_agent: event.userAgent ?? null,
    });

    if (error) {
      console.error("[audit] failed to write audit_log entry", event.action, error.message);
    }
  } catch (err) {
    console.error("[audit] unexpected error writing audit_log entry", event.action, err);
  }
}

/** Best-effort client IP extraction from standard proxy headers. */
export function getClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }
  return headers.get("x-real-ip");
}
