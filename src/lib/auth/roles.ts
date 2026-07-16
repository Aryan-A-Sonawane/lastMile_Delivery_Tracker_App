import type { User } from "@supabase/supabase-js";

/**
 * App capabilities. A user may hold several (e.g. CUSTOMER + AGENT). Declared as
 * a plain string union so this module stays edge-safe (importable from the proxy
 * without pulling in Prisma).
 */
export type Role = "CUSTOMER" | "AGENT" | "ADMIN";

/** Landing route per role. */
export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  AGENT: "/agent",
  CUSTOMER: "/app",
};

/** Route prefixes that require a specific capability. */
const PROTECTED_PREFIXES: { prefix: string; role: Role }[] = [
  { prefix: "/admin", role: "ADMIN" },
  { prefix: "/agent", role: "AGENT" },
  { prefix: "/app", role: "CUSTOMER" },
];

/** The capability required to access `pathname`, or null if public. */
export function getRequiredRole(pathname: string): Role | null {
  const match = PROTECTED_PREFIXES.find(
    (p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/"),
  );
  return match?.role ?? null;
}

/** Reads the capability set from a Supabase user (JWT app_metadata.roles),
 * falling back to the legacy single `role` claim. */
export function getUserRoles(user: User | null): Role[] {
  const meta = user?.app_metadata ?? {};
  const raw: unknown = Array.isArray(meta.roles)
    ? meta.roles
    : meta.role
      ? [meta.role]
      : [];
  return (raw as unknown[]).filter(
    (r): r is Role => r === "ADMIN" || r === "AGENT" || r === "CUSTOMER",
  );
}

/**
 * Can this user access an area requiring `required`? Admins can access/preview
 * every area (customer + agent), so the view switcher works.
 */
export function hasCapability(user: User | null, required: Role): boolean {
  const roles = getUserRoles(user);
  if (roles.includes("ADMIN")) return true;
  return roles.includes(required);
}

/** The best home for a user given their capabilities (ADMIN > AGENT > CUSTOMER). */
export function primaryHome(roles: Role[]): string {
  if (roles.includes("ADMIN")) return ROLE_HOME.ADMIN;
  if (roles.includes("AGENT")) return ROLE_HOME.AGENT;
  return ROLE_HOME.CUSTOMER;
}
