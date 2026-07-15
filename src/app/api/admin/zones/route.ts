import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { zoneInputSchema } from "@/lib/validation/config";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const zones = await prisma.zone.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { areas: true } } },
  });
  return NextResponse.json({ data: zones });
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const input = zoneInputSchema.parse(await req.json());
  const zone = await prisma.zone.create({ data: input });
  return NextResponse.json({ data: zone }, { status: 201 });
});
