import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { areaInputSchema } from "@/lib/validation/config";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  // Only the fields the areas table + edit dialog need — the full table can be
  // ~1.4k rows, so we keep the payload lean (no lat/lng/timestamps).
  const areas = await prisma.area.findMany({
    orderBy: { pincode: "asc" },
    select: {
      id: true,
      pincode: true,
      name: true,
      city: true,
      state: true,
      zoneId: true,
      zone: { select: { id: true, name: true, code: true } },
    },
  });
  return NextResponse.json({ data: areas });
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const input = areaInputSchema.parse(await req.json());
  const area = await prisma.area.create({ data: input });
  return NextResponse.json({ data: area }, { status: 201 });
});
