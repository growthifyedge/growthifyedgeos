import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware for the WhatsApp auto-responder app.
 *
 *  1. /api/whatsapp is PUBLIC — Meta must reach the webhook with no auth.
 *  2. The old agency routes (/admin, /agent, /login) are retired -> redirect home.
 *  3. Everything else (the inbox dashboard) is protected with HTTP Basic Auth,
 *     but only if DASHBOARD_PASSWORD is set. If it isn't, the dashboard is open
 *     (a warning banner is shown on the page) so you're never locked out.
 *
 * Runs on the Edge runtime, so we use atob() (not Buffer) for base64.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Let the WhatsApp webhook through untouched.
  if (pathname.startsWith("/api/whatsapp")) {
    return NextResponse.next();
  }

  // 2. Retire the old agency routes.
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/agent") ||
    pathname === "/login"
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // 3. Password-gate the dashboard (only if a password is configured).
  const password = process.env.DASHBOARD_PASSWORD;
  if (password) {
    const user = process.env.DASHBOARD_USER || "admin";
    const header = request.headers.get("authorization");

    let authed = false;
    if (header?.startsWith("Basic ")) {
      try {
        const [u, p] = atob(header.slice(6)).split(":");
        authed = u === user && p === password;
      } catch {
        authed = false;
      }
    }

    if (!authed) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="GrowthifyEdge WhatsApp"' },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and static image assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
