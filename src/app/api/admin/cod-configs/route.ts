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

// One COD config per orderType — saving overwrites the existing entry rather
// than stacking duplicates. Historical orders keep their own charge snapshot.
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const input = codConfigInputSchema.parse(await req.json());
  const codConfig = await prisma.codConfig.upsert({
    where: { orderType: input.orderType },
    create: input,
    update: input,
  });
  return NextResponse.json({ data: codConfig }, { status: 201 });
});
