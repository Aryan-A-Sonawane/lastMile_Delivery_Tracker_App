import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { areaInputSchema } from "@/lib/validation/config";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApi(async (req: NextRequest, { params }: Ctx) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const input = areaInputSchema.partial().parse(await req.json());
  const area = await prisma.area.update({ where: { id }, data: input });
  return NextResponse.json({ data: area });
});

export const DELETE = withApi(async (_req: NextRequest, { params }: Ctx) => {
  await requireRole("ADMIN");
  const { id } = await params;
  await prisma.area.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
