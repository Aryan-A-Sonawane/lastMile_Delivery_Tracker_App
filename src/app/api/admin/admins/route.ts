import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { createOrPromoteAdmin } from "@/lib/admin/create-admin";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(120),
});

export const GET = withApi(async () => {
  const me = await requireRole("ADMIN");
  const admins = await prisma.profile.findMany({
    where: { roles: { has: "ADMIN" } },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ data: { admins, currentId: me.id } });
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const { email, name } = inviteSchema.parse(await req.json());
  const result = await createOrPromoteAdmin({ email, name });
  return NextResponse.json({ data: result }, { status: 201 });
});
