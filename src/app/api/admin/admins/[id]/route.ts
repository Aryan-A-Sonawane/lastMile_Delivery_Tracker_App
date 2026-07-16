import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi, badRequest, conflict, notFound } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

// Revoke a user's admin access (demote to CUSTOMER — keeps the account).
export const DELETE = withApi(async (_req: NextRequest, { params }: Ctx) => {
  const me = await requireRole("ADMIN");
  const { id } = await params;

  if (me.id === id) throw badRequest("You can't remove your own admin access.");

  const adminCount = await prisma.profile.count({ where: { roles: { has: "ADMIN" } } });
  if (adminCount <= 1) throw conflict("Cannot remove the last admin.");

  const target = await prisma.profile.findUnique({
    where: { id },
    select: { roles: true },
  });
  if (!target || !target.roles.includes("ADMIN")) throw notFound("Admin not found");

  // Remove only the ADMIN capability; keep any customer/agent capability.
  const remaining = target.roles.filter((r) => r !== "ADMIN");
  const roles = (remaining.length ? remaining : ["CUSTOMER"]) as (
    | "CUSTOMER"
    | "AGENT"
    | "ADMIN"
  )[];
  const primary = roles.includes("AGENT") ? "AGENT" : "CUSTOMER";

  await prisma.profile.update({ where: { id }, data: { role: primary, roles } });
  const supabase = createAdminClient();
  const { data: u } = await supabase.auth.admin.getUserById(id);
  await supabase.auth.admin
    .updateUserById(id, {
      app_metadata: { ...(u?.user?.app_metadata ?? {}), role: primary, roles },
    })
    .catch(() => {});

  return NextResponse.json({ ok: true });
});
