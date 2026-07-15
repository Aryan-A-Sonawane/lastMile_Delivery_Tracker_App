import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { codConfigInputSchema } from "@/lib/validation/config";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(async (req: NextRequest, { params }: Ctx) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const input = codConfigInputSchema.partial().parse(await req.json());
  const codConfig = await prisma.codConfig.update({ where: { id }, data: input });
  return NextResponse.json({ data: codConfig });
});

export const DELETE = withApi(async (_req: NextRequest, { params }: Ctx) => {
  await requireRole("ADMIN");
  const { id } = await params;
  await prisma.codConfig.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
