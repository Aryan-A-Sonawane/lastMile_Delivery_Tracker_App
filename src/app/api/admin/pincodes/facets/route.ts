import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

// Distinct states (or cities within a state) for the area-search narrowing.
export const GET = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const state = req.nextUrl.searchParams.get("state")?.trim() || undefined;

  if (state) {
    const rows = await prisma.pincodeRef.findMany({
      where: { state },
      distinct: ["city"],
      select: { city: true },
      orderBy: { city: "asc" },
      take: 1000,
    });
    return NextResponse.json({
      data: { cities: rows.map((r) => r.city).filter(Boolean) },
    });
  }

  const rows = await prisma.pincodeRef.findMany({
    distinct: ["state"],
    select: { state: true },
    orderBy: { state: "asc" },
    take: 100,
  });
  return NextResponse.json({
    data: { states: rows.map((r) => r.state).filter(Boolean) },
  });
});
