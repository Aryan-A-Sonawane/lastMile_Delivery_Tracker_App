import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi, notFound, forbidden } from "@/lib/api/errors";
import { statusUpdateSchema } from "@/lib/validation/order";
import { updateOrderStatus } from "@/lib/orders/update-status";
import { broadcastOrderEvent } from "@/lib/realtime/broadcast";
import { notifyOrderStatus } from "@/lib/notifications/notify";

type Ctx = { params: Promise<{ id: string }> };

// Agents update the status of orders assigned to them; admins may override any.
export const POST = withApi(async (req: NextRequest, { params }: Ctx) => {
  const profile = await requireRole("AGENT", "ADMIN");
  const { id } = await params;
  const input = statusUpdateSchema.parse(await req.json());

  // Non-admins may only update orders assigned to them; admins can override.
  if (!profile.roles.includes("ADMIN")) {
    const [agent, order] = await Promise.all([
      prisma.agentProfile.findUnique({
        where: { profileId: profile.id },
        select: { id: true },
      }),
      prisma.order.findUnique({
        where: { id },
        select: { currentAgentId: true },
      }),
    ]);
    if (!order) throw notFound("Order not found");
    if (!agent || order.currentAgentId !== agent.id) {
      throw forbidden("This order is not assigned to you");
    }
  }

  const updated = await updateOrderStatus({
    orderId: id,
    toStatus: input.status,
    actorProfileId: profile.id,
    actorRole: profile.roles.includes("ADMIN") ? "ADMIN" : "AGENT",
    note: input.note,
    reason: input.reason,
    lat: input.lat,
    lng: input.lng,
  });

  await broadcastOrderEvent(updated.trackingNumber, { status: updated.status });
  await notifyOrderStatus(updated.id);
  return NextResponse.json({ data: updated });
});
