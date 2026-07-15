import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { withApi, notFound, forbidden } from "@/lib/api/errors";
import { orderDetailInclude } from "@/lib/orders/includes";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi(async (_req: NextRequest, { params }: Ctx) => {
  const profile = await requireProfile();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: orderDetailInclude,
  });
  if (!order) throw notFound("Order not found");

  if (profile.role === "CUSTOMER" && order.customerId !== profile.id) {
    throw forbidden();
  }
  if (profile.role === "AGENT") {
    const agent = await prisma.agentProfile.findUnique({
      where: { profileId: profile.id },
      select: { id: true },
    });
    if (order.currentAgentId !== agent?.id) throw forbidden();
  }

  return NextResponse.json({ data: order });
});
