import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { settingInputSchema } from "@/lib/validation/config";
import { AUTO_ASSIGN_KEY, sweepPendingAssignments } from "@/lib/orders/auto-assign";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ data: settings });
});

// Upsert a setting by key (settings are a fixed key/value space).
export const PUT = withApi(async (req: NextRequest) => {
  const admin = await requireRole("ADMIN");
  const { key, value, description } = settingInputSchema.parse(await req.json());
  const setting = await prisma.setting.upsert({
    where: { key },
    create: { key, value, description: description ?? null },
    update: { value, description: description ?? null },
  });

  // Flipping auto-assign ON sweeps every unassigned pending order right away.
  let swept: { assigned: number; pending: number } | undefined;
  if (key === AUTO_ASSIGN_KEY && value.trim().toLowerCase() === "true") {
    swept = await sweepPendingAssignments(admin.id);
  }

  return NextResponse.json({ data: setting, swept });
});
