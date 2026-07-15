import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getRequiredRole, getUserRole, ROLE_HOME } from "@/lib/auth/roles";

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

  // Signed in but wrong role → bounce to their own home (or login if unknown).
  const role = getUserRole(user);
  if (role !== requiredRole) {
    const url = request.nextUrl.clone();
    url.pathname = role ? ROLE_HOME[role] : "/login";
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
