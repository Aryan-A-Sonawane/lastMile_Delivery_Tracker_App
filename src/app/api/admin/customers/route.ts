import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

// Customer directory for admin order-on-behalf selection.
export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const customers = await prisma.profile.findMany({
    where: { roles: { has: "CUSTOMER" } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: customers });
});
