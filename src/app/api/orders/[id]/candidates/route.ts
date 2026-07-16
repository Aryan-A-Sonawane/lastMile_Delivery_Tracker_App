import { type NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { rankAgentsForOrder } from "@/lib/orders/assign";

type Ctx = { params: Promise<{ id: string }> };

// Admin: ranked agents for manually assigning an order (map + top suggestions).
export const GET = withApi(async (_req: NextRequest, { params }: Ctx) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const data = await rankAgentsForOrder(id);
  return NextResponse.json({ data });
});
