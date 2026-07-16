import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isEmailConfigured } from "@/lib/notifications/email";
import { badRequest, conflict } from "@/lib/api/errors";

export type CreateAgentInput = {
  name: string;
  email: string;
  phone?: string | null;
  homeZoneId?: string | null;
  maxActiveOrders?: number;
  currentLat?: number;
  currentLng?: number;
};

function tempPassword(): string {
  return randomBytes(9).toString("base64url"); // ~12 url-safe chars
}

/**
 * Creates a delivery-agent account: a confirmed Supabase auth user (role AGENT),
 * the Profile + AgentProfile, and a welcome email with a temporary password.
 * Returns the tempPassword so an admin doing a bulk import can distribute it.
 */
export async function createAgent(input: CreateAgentInput): Promise<{
  agentId: string;
  profileId: string;
  tempPassword: string;
}> {
  const supabase = createAdminClient();
  const password = tempPassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { name: input.name },
    app_metadata: { role: "AGENT", roles: ["AGENT"] },
  });

  if (error || !data.user) {
    const msg = error?.message ?? "Could not create agent";
    if (/already|registered|exists/i.test(msg)) {
      throw conflict("An account with this email already exists");
    }
    throw badRequest(msg);
  }

  const profileId = data.user.id;
  const hasLocation = input.currentLat != null && input.currentLng != null;

  const agent = await prisma.$transaction(async (tx) => {
    await tx.profile.create({
      data: {
        id: profileId,
        email: input.email,
        name: input.name,
        phone: input.phone ?? null,
        role: "AGENT",
        roles: ["AGENT"],
      },
    });
    return tx.agentProfile.create({
      data: {
        profileId,
        homeZoneId: input.homeZoneId ?? null,
        maxActiveOrders: input.maxActiveOrders ?? 5,
        currentLat: input.currentLat ?? null,
        currentLng: input.currentLng ?? null,
        status: hasLocation ? "AVAILABLE" : "OFFLINE",
        lastLocationAt: hasLocation ? new Date() : null,
      },
    });
  });

  if (isEmailConfigured()) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const loginUrl = `${base}/login`;
    sendEmail({
      to: input.email,
      subject: "Your delivery-agent account is ready",
      text: `Hi ${input.name},\n\nAn agent account has been created for you.\nSign in at ${loginUrl}\nEmail: ${input.email}\nTemporary password: ${password}\n\nPlease change it after signing in.`,
      html: `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 8px;font-size:18px">Your agent account is ready</h2>
        <p style="margin:0 0 12px;color:#475569">Hi ${input.name}, an agent account has been created for you.</p>
        <p style="margin:0 0 4px"><strong>Email:</strong> ${input.email}</p>
        <p style="margin:0 0 16px"><strong>Temporary password:</strong> <code>${password}</code></p>
        <a href="${loginUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Sign in</a>
      </div>`,
    }).catch((e) => console.error("agent welcome email failed:", e));
  }

  return { agentId: agent.id, profileId, tempPassword: password };
}
