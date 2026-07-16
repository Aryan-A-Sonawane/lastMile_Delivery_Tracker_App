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

  // Admins see any order; others must be the customer-owner or the assigned agent.
  if (!profile.roles.includes("ADMIN")) {
    const isOwner = order.customerId === profile.id;
    let isAssignedAgent = false;
    if (profile.roles.includes("AGENT")) {
      const agent = await prisma.agentProfile.findUnique({
        where: { profileId: profile.id },
        select: { id: true },
      });
      isAssignedAgent = !!agent && order.currentAgentId === agent.id;
    }
    if (!isOwner && !isAssignedAgent) throw forbidden();
  }

  return NextResponse.json({ data: order });
});
