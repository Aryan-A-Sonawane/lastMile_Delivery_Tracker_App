import type { User } from "@supabase/supabase-js";

/**
 * App authorization role. Mirrors the Prisma `Role` enum, but is declared as a
 * plain string union here so this module stays edge-safe (importable from
 * middleware without pulling in the Prisma client).
 */
export type Role = "CUSTOMER" | "AGENT" | "ADMIN";

/** Landing route each role is sent to after login. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  AGENT: "/agent",
  CUSTOMER: "/app",
};

/** Route prefixes that require a specific role. */
const PROTECTED_PREFIXES: { prefix: string; role: Role }[] = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/agent", role: "AGENT" },
  { prefix: "/app", role: "CUSTOMER" },
];

/** Returns the role required to access `pathname`, or null if the route is public. */
export function getRequiredRole(pathname: string): Role | null {
  const match = PROTECTED_PREFIXES.find(
    (p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"),
  );
  return match?.role ?? null;
}

/**
 * Reads the authorization role from a Supabase user. The role is mirrored into
 * the JWT via a custom access-token claim (wired in Phase 3); until then this
 * falls back to user metadata and returns null when absent.
 */
export function getUserRole(user: User | null): Role | null {
  const raw = (user?.app_metadata?.role ?? user?.user_metadata?.role) as
    | string
    | undefined;
  if (raw === "ADMIN" || raw === "AGENT" || raw === "CUSTOMER") return raw;
  return null;
}
