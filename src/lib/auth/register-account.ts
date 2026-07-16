import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, conflict } from "@/lib/api/errors";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  accountType: "CUSTOMER" | "AGENT";
  phone?: string;
};

function primaryRole(roles: Role[]): Role {
  if (roles.includes("ADMIN")) return "ADMIN";
  if (roles.includes("AGENT")) return "AGENT";
  return "CUSTOMER";
}

async function findUserByEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

/**
 * Registers a customer or agent account. If the email already exists, the
 * requested capability is ADDED to that account — but only after verifying the
 * password (so one person can hold both a customer and an agent profile on one
 * login). Returns whether a brand-new account was created.
 */
export async function registerAccount(
  input: RegisterInput,
): Promise<{ created: boolean }> {
  const admin = createAdminClient();
  const existing = await findUserByEmail(admin, input.email);

  if (existing) {
    // Prove ownership before adding a capability.
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { error: pwErr } = await anon.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (pwErr) {
      throw conflict(
        "An account with this email already exists. Sign in with the correct password to add a profile.",
      );
    }

    const profile = await prisma.profile.findUnique({ where: { id: existing.id } });
    const current = (profile?.roles ?? ["CUSTOMER"]) as Role[];
    if (current.includes(input.accountType)) {
      throw conflict(`You already have a ${input.accountType.toLowerCase()} profile.`);
    }

    const roles = [...new Set([...current, input.accountType])] as Role[];
    await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...existing.app_metadata, role: primaryRole(roles), roles },
    });
    await prisma.profile.update({
      where: { id: existing.id },
      data: { role: primaryRole(roles), roles },
    });
    if (input.accountType === "AGENT") {
      const agent = await prisma.agentProfile.findUnique({
        where: { profileId: existing.id },
      });
      if (!agent) {
        await prisma.agentProfile.create({
          data: { profileId: existing.id, status: "OFFLINE" },
        });
      }
    }
    return { created: false };
  }

  // Fresh account.
  const roles: Role[] = [input.accountType];
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
    app_metadata: { role: input.accountType, roles },
  });
  if (error || !data.user) {
    throw badRequest(error?.message ?? "Could not create account");
  }

  await prisma.profile.create({
    data: {
      id: data.user.id,
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      role: input.accountType,
      roles,
    },
  });
  if (input.accountType === "AGENT") {
    await prisma.agentProfile.create({
      data: { profileId: data.user.id, status: "OFFLINE" },
    });
  }
  return { created: true };
}
