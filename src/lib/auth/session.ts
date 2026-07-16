import type { Profile } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { forbidden, unauthorized } from "@/lib/api/errors";
import type { Role } from "./roles";

/** The Supabase auth user for the current request, or null. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
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
