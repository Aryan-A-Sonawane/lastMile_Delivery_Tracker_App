import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  getRequiredRole,
  hasCapability,
  getUserRoles,
  primaryHome,
} from "@/lib/auth/roles";

// Next.js 16 "proxy" convention (formerly `middleware`). Runs on the edge before
// matched routes: refreshes the Supabase session and enforces role-based access.
export async function proxy(request: NextRequest) {
  // Always refresh the Supabase session so downstream Server Components see a
  // valid user and rotated cookies are forwarded.
  const { response, user } = await updateSession(request);

  const { pathname } = request.nextUrl;
  const requiredRole = getRequiredRole(pathname);

  // Public route — nothing more to enforce.
  if (!requiredRole) return response;

  // Not signed in → send to login, remembering where they were headed.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in but lacks the capability → bounce to their own home (admins can
  // access every area, so this only blocks users missing the capability).
  if (!hasCapability(user, requiredRole)) {
    const roles = getUserRoles(user);
    const url = request.nextUrl.clone();
    url.pathname = roles.length ? primaryHome(roles) : "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Run on all paths except Next internals and static image assets.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
