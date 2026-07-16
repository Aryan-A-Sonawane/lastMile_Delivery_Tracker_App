import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi, badRequest, notFound, forbidden } from "@/lib/api/errors";
import { statusUpdateSchema } from "@/lib/validation/order";
import { updateOrderStatus } from "@/lib/orders/update-status";
import { hasAttemptsRemaining, MAX_DELIVERY_ATTEMPTS } from "@/lib/orders/attempts";
import { broadcastOrderEvent } from "@/lib/realtime/broadcast";
import { notifyOrderStatus } from "@/lib/notifications/notify";

type Ctx = { params: Promise<{ id: string }> };

// Agents update the status of orders assigned to them; admins may override any.
export const POST = withApi(async (req: NextRequest, { params }: Ctx) => {
  const profile = await requireRole("AGENT", "ADMIN");
  const { id } = await params;
  const input = statusUpdateSchema.parse(await req.json());
  const isAdmin = profile.roles.includes("ADMIN");

  // An agent reporting a failed delivery must leave a remark explaining why.
  if (input.status === "FAILED" && !isAdmin && !input.note?.trim()) {
    throw badRequest("Please add a remark explaining why the delivery failed.");
  }

  // Non-admins may only update orders assigned to them; admins can override.
  if (!isAdmin) {
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
    actorRole: isAdmin ? "ADMIN" : "AGENT",
    note: input.note,
    reason: input.reason,
    lat: input.lat,
    lng: input.lng,
  });

  await broadcastOrderEvent(updated.trackingNumber, { status: updated.status });
  await notifyOrderStatus(updated.id);

  // When the final allowed attempt fails, the shipment is returned to sender.
  let finalStatus = updated.status;
  if (updated.status === "FAILED" && !hasAttemptsRemaining(updated.attemptNumber)) {
    const rts = await updateOrderStatus({
      orderId: id,
      toStatus: "RETURN_TO_SENDER",
      actorProfileId: null,
      actorRole: "SYSTEM",
      note: `Returned to sender after ${MAX_DELIVERY_ATTEMPTS} failed delivery attempts`,
    });
    await broadcastOrderEvent(rts.trackingNumber, { status: rts.status });
    await notifyOrderStatus(rts.id);
    finalStatus = rts.status;
  }

  return NextResponse.json({ data: { ...updated, status: finalStatus } });
});
