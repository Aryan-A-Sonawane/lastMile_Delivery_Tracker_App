import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

// Agent directory with live status + load, for manual assignment and monitoring.
export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const agents = await prisma.agentProfile.findMany({
    include: {
      profile: { select: { id: true, name: true, email: true, phone: true } },
      homeZone: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ data: agents });
});
