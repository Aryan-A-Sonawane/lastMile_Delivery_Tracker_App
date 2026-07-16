import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/notifications/email";
import { badRequest } from "@/lib/api/errors";
import { getAppUrl } from "@/lib/config/app-url";

async function findUserByEmail(supabase: SupabaseClient, email: string) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

/**
 * Grants admin access to an email: creates a new confirmed admin account (with a
 * temp password emailed to them) or promotes an existing user to ADMIN. Returns
 * the temp password when a new account was created.
 */
export async function createOrPromoteAdmin(input: {
  email: string;
  name: string;
}): Promise<{ profileId: string; created: boolean; tempPassword: string | null }> {
  const supabase = createAdminClient();
  const existing = await findUserByEmail(supabase, input.email);

  let profileId: string;
  let created = false;
  let tempPassword: string | null = null;

  let roles: string[] = ["ADMIN"];

  if (existing) {
    profileId = existing.id;
    const prior = Array.isArray(existing.app_metadata?.roles)
      ? (existing.app_metadata.roles as string[])
      : existing.app_metadata?.role
        ? [existing.app_metadata.role as string]
        : [];
    roles = [...new Set([...prior, "ADMIN"])];
    await supabase.auth.admin.updateUserById(profileId, {
      app_metadata: { ...existing.app_metadata, role: "ADMIN", roles },
    });
  } else {
    const password = randomBytes(9).toString("base64url");
    const { data, error } = await supabase.auth.admin.createUser({
      email: input.email,
      password,
      email_confirm: true,
      user_metadata: { name: input.name },
      app_metadata: { role: "ADMIN", roles },
    });
    if (error || !data.user) {
      throw badRequest(error?.message ?? "Could not create admin");
    }
    profileId = data.user.id;
    created = true;
    tempPassword = password;
  }

  const roleEnum = roles as ("CUSTOMER" | "AGENT" | "ADMIN")[];
  await prisma.profile.upsert({
    where: { id: profileId },
    create: { id: profileId, email: input.email, name: input.name, role: "ADMIN", roles: roleEnum },
    update: { role: "ADMIN", name: input.name, roles: roleEnum },
  });

  if (isEmailConfigured()) {
    const base = getAppUrl();
    const loginUrl = `${base}/login`;
    const body = created
      ? `You've been added as an administrator.\nSign in at ${loginUrl}\nEmail: ${input.email}\nTemporary password: ${tempPassword}`
      : `You've been granted administrator access. Sign in at ${loginUrl} with your existing password.`;
    sendEmail({
      to: input.email,
      subject: "You're now an administrator",
      text: body,
      html: `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 8px;font-size:18px">Administrator access granted</h2>
        <p style="margin:0 0 12px;color:#475569">${created ? `An admin account was created for you.` : `Your account now has admin access.`}</p>
        ${created ? `<p style="margin:0 0 4px"><strong>Email:</strong> ${input.email}</p><p style="margin:0 0 16px"><strong>Temporary password:</strong> <code>${tempPassword}</code></p>` : ""}
        <a href="${loginUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Sign in</a>
      </div>`,
    }).catch((e) => console.error("admin invite email failed:", e));
  }

  return { profileId, created, tempPassword };
}
