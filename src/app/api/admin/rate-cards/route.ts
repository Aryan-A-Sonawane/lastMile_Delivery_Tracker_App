import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { rateCardInputSchema } from "@/lib/validation/config";

export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const rateCards = await prisma.rateCard.findMany({
    orderBy: [{ orderType: "asc" }, { scope: "asc" }, { effectiveFrom: "desc" }],
  });
  return NextResponse.json({ data: rateCards });
});

// One rate card per (orderType, scope) — saving overwrites the existing entry
// rather than stacking duplicates. Historical orders keep their charge snapshot.
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const input = rateCardInputSchema.parse(await req.json());
  const rateCard = await prisma.rateCard.upsert({
    where: { orderType_scope: { orderType: input.orderType, scope: input.scope } },
    create: input,
    update: input,
  });
  return NextResponse.json({ data: rateCard }, { status: 201 });
});
