import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi, forbidden, notFound } from "@/lib/api/errors";
import { rescheduleSchema } from "@/lib/validation/order";
import { rescheduleOrder } from "@/lib/orders/reschedule";
import { assignAgent } from "@/lib/orders/assign";
import { broadcastOrderEvent } from "@/lib/realtime/broadcast";
import { notifyOrderStatus } from "@/lib/notifications/notify";

type Ctx = { params: Promise<{ id: string }> };

// Customer (own order) or admin reschedules a FAILED delivery. The order is
// then auto-reassigned to a fresh agent (excluding the one who failed); if none
// is available it stays RESCHEDULED for manual assignment.
export const POST = withApi(async (req: NextRequest, { params }: Ctx) => {
  const profile = await requireRole("CUSTOMER", "ADMIN");
  const { id } = await params;
  const { requestedDate, reason } = rescheduleSchema.parse(await req.json());

  if (profile.role === "CUSTOMER") {
    const order = await prisma.order.findUnique({
      where: { id },
      select: { customerId: true },
    });
    if (!order) throw notFound("Order not found");
    if (order.customerId !== profile.id) throw forbidden();
  }

  const { previousAgentId } = await rescheduleOrder({
    orderId: id,
    requestedDate,
    reason,
    actorProfileId: profile.id,
    actorRole: profile.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
  });

  let reassigned = false;
  try {
    await assignAgent({
      orderId: id,
      mode: "AUTO",
      assignedById: profile.id,
      excludeAgentId: previousAgentId ?? undefined,
    });
    reassigned = true;
  } catch {
    // No available agent right now — order stays RESCHEDULED for manual assign.
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    select: { trackingNumber: true, status: true },
  });
  await broadcastOrderEvent(order.trackingNumber, { status: order.status });
  await notifyOrderStatus(id);

  return NextResponse.json({ data: { reassigned, status: order.status } });
});
