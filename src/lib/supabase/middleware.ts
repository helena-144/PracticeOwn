import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getClientIp, logAuditEvent } from "@/lib/audit";
import type { Database } from "@/types/database";

const IDLE_TIMEOUT_SECONDS = 15 * 60;
const LAST_ACTIVITY_COOKIE = "pw_last_activity";

const AUTH_ONLY_ROUTES = ["/login", "/signup"];
const MFA_EXEMPT_ROUTES = ["/mfa-setup", "/mfa-challenge"];

function requiresAuth(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    MFA_EXEMPT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`))
  );
}

function isMfaExemptRoute(pathname: string): boolean {
  return MFA_EXEMPT_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isAuthOnlyRoute(pathname: string): boolean {
  return AUTH_ONLY_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * Redirects, carrying over any Set-Cookie headers already written onto
 * `base` (refreshed session tokens from supabase.auth.getUser(), or cleared
 * auth cookies from a just-completed signOut()). Building a bare
 * `NextResponse.redirect()` instead would silently drop those — the browser
 * would never see the rotated/cleared cookies.
 */
function redirectWithCookies(base: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  base.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

function loginRedirect(request: NextRequest, base: NextResponse, reason?: string): NextResponse {
  const redirectUrl = new URL("/login", request.url);
  redirectUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
  if (reason) redirectUrl.searchParams.set("reason", reason);
  const redirect = redirectWithCookies(base, redirectUrl);
  redirect.cookies.delete(LAST_ACTIVITY_COOKIE);
  return redirect;
}

function mfaRedirect(
  request: NextRequest,
  base: NextResponse,
  target: "/mfa-setup" | "/mfa-challenge"
): NextResponse {
  const redirectUrl = new URL(target, request.url);
  redirectUrl.searchParams.set("redirectedFrom", request.nextUrl.pathname);
  return redirectWithCookies(base, redirectUrl);
}

/**
 * Refreshes the Supabase auth session on every request, enforces route
 * protection, a 15-minute idle timeout, and MFA enrollment/verification —
 * then hands off to the destination route. Called from the root
 * src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // --- Idle timeout -----------------------------------------------------------
  // A sliding 15-minute window tracked via a cookie set on every authenticated
  // request. If the gap since the last request exceeds the window, the
  // session is force-expired here, before any route logic runs.
  if (user) {
    const lastActivityRaw = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    const lastActivityMs = lastActivityRaw ? Number(lastActivityRaw) : null;
    const nowMs = Date.now();

    const isIdleExpired =
      lastActivityMs !== null &&
      Number.isFinite(lastActivityMs) &&
      nowMs - lastActivityMs > IDLE_TIMEOUT_SECONDS * 1000;

    if (isIdleExpired) {
      await logAuditEvent({
        userId: user.id,
        action: "LOGOUT",
        ipAddress: getClientIp(request.headers),
        userAgent: request.headers.get("user-agent"),
      });
      await supabase.auth.signOut();
      return loginRedirect(request, response, "idle_timeout");
    }

    // First authenticated request we've seen for this session (cookie
    // absent) — this is the login moment from middleware's vantage point.
    if (lastActivityMs === null) {
      await logAuditEvent({
        userId: user.id,
        action: "LOGIN",
        ipAddress: getClientIp(request.headers),
        userAgent: request.headers.get("user-agent"),
      });
    }

    const expiresAt = nowMs + IDLE_TIMEOUT_SECONDS * 1000;
    response.cookies.set(LAST_ACTIVITY_COOKIE, String(nowMs), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: IDLE_TIMEOUT_SECONDS,
    });
    response.headers.set("X-Session-Idle-Timeout-Seconds", String(IDLE_TIMEOUT_SECONDS));
    response.headers.set("X-Session-Expires-At", new Date(expiresAt).toISOString());
  }

  // --- Route protection ---------------------------------------------------------
  if (!user && requiresAuth(pathname)) {
    return loginRedirect(request, response);
  }

  if (user && isAuthOnlyRoute(pathname)) {
    return redirectWithCookies(response, new URL("/dashboard", request.url));
  }

  // --- MFA enforcement -------------------------------------------------------------
  // All accounts must have MFA enrolled. A session that hasn't completed a
  // TOTP challenge this login is only aal1; dashboard access requires aal2.
  if (user && requiresAuth(pathname) && !isMfaExemptRoute(pathname)) {
    try {
      const verifiedFactors = (user.factors ?? []).filter((factor) => factor.status === "verified");

      if (verifiedFactors.length === 0) {
        return mfaRedirect(request, response, "/mfa-setup");
      }

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.currentLevel !== "aal2") {
        return mfaRedirect(request, response, "/mfa-challenge");
      }
    } catch (err) {
      // Fail open: MFA is a hardening layer on top of the password check
      // that already gated this request. A transient SDK/network error here
      // shouldn't lock users out of the app entirely.
      console.error("[middleware] MFA status check failed", err);
    }
  }

  return response;
}
