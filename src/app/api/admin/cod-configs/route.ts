import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { codConfigInputSchema } from "@/lib/validation/config";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const codConfigs = await prisma.codConfig.findMany({
    orderBy: [{ orderType: "asc" }, { effectiveFrom: "desc" }],
  });
  return NextResponse.json({ data: codConfigs });
});

export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const input = codConfigInputSchema.parse(await req.json());
  const codConfig = await prisma.codConfig.create({ data: input });
  return NextResponse.json({ data: codConfig }, { status: 201 });
});
