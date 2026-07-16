import { type NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

// Autocomplete over the PincodeRef reference data — by area/city name or pincode,
// optionally narrowed by state and city.
export const GET = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").trim();
  const state = p.get("state")?.trim() || undefined;
  const city = p.get("city")?.trim() || undefined;

  const where: Prisma.PincodeRefWhereInput = {
    ...(state ? { state } : {}),
    ...(city ? { city } : {}),
    ...(q
      ? {
          OR: [
            { area: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { pincode: { startsWith: q } },
          ],
        }
      : {}),
  };

  const results = await prisma.pincodeRef.findMany({
    where,
    take: 25,
    orderBy: [{ area: "asc" }],
  });
  return NextResponse.json({ data: results });
});
