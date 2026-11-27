import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic check only: without a session cookie, staff pages go straight to
 * the login. The cookie is not validated here; every page and service still
 * calls `requireUser()`.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/prihlaseni", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Add each staff URL here when its page is built.
    "/dnes/:path*",
    "/nova/:path*",
    "/plan/:path*",
  ],
};
