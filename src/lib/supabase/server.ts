import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";

/**
 * Server-side Supabase client scoped to the caller's session (RLS-enforced).
 * Use inside Server Components, Route Handlers, and Server Actions.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context to mutate.
            // Session refresh is handled by the middleware instead.
          }
        },
      },
    }
  );
}

/**
 * Service-role Supabase client that bypasses RLS. Server-only — never import
 * this from a Client Component or expose the key to the browser. Restricted
 * to trusted server contexts such as Stripe webhooks, scheduled jobs, and
 * audit logging (see src/lib/audit.ts).
 *
 * Built on the plain @supabase/supabase-js client rather than @supabase/ssr:
 * service-role access carries no user session, so there's no cookie jar to
 * wire up in the first place.
 */
export function createServiceRoleClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
