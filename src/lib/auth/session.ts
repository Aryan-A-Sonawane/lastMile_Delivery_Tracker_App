import type { Profile } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { forbidden, unauthorized } from "@/lib/api/errors";
import type { Role } from "./roles";

type SessionUser = {
  id: string;
  email: string | null;
  app_metadata: Record<string, unknown>;
};

/**
 * The Supabase auth user for the current request, or null. Verifies the JWT
 * *locally* via `getClaims()` (the project signs with ES256, so validation uses
 * a cached JWKS and no network round trip) — this runs on every page and API
 * call, so avoiding the per-request Auth-server hop is a meaningful speedup.
 * Falls back to the network `getUser()` if local verification can't be done.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!error && claims?.sub) {
      return {
        id: claims.sub,
        email: (claims.email as string | undefined) ?? null,
        app_metadata: (claims.app_metadata as Record<string, unknown>) ?? {},
      };
    }
  } catch {
    // fall through to network validation
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user
    ? { id: user.id, email: user.email ?? null, app_metadata: user.app_metadata ?? {} }
    : null;
}

/** The app Profile for the signed-in user, or null. */
export async function getSessionProfile(): Promise<Profile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  return prisma.profile.findUnique({ where: { id: user.id } });
}

/** Requires an authenticated user with a profile; throws 401 otherwise. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) throw unauthorized();
  return profile;
}

/** Requires the signed-in user to hold at least one of `roles` as a capability;
 * throws 401/403 otherwise. */
export async function requireRole(...roles: Role[]): Promise<Profile> {
  const profile = await requireProfile();
  const caps = profile.roles as Role[];
  if (!caps.some((r) => roles.includes(r))) throw forbidden();
  return profile;
}
