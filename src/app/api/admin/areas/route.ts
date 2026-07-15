import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { areaInputSchema } from "@/lib/validation/config";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const areas = await prisma.area.findMany({
    orderBy: { pincode: "asc" },
    include: { zone: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json({ data: areas });
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const input = areaInputSchema.parse(await req.json());
  const area = await prisma.area.create({ data: input });
  return NextResponse.json({ data: area }, { status: 201 });
});
