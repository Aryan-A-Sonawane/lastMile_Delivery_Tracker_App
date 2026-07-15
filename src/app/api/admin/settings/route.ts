import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { settingInputSchema } from "@/lib/validation/config";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const settings = await prisma.setting.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ data: settings });
});

// Upsert a setting by key (settings are a fixed key/value space).
export const PUT = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const { key, value, description } = settingInputSchema.parse(await req.json());
  const setting = await prisma.setting.upsert({
    where: { key },
    create: { key, value, description: description ?? null },
    update: { value, description: description ?? null },
  });
  return NextResponse.json({ data: setting });
});
