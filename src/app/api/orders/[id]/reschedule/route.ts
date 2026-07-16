import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi, forbidden, notFound } from "@/lib/api/errors";
import { rescheduleSchema } from "@/lib/validation/order";
import { rescheduleOrder } from "@/lib/orders/reschedule";
import { assignAgent } from "@/lib/orders/assign";
import { isAutoAssignEnabled } from "@/lib/orders/auto-assign";
import { broadcastOrderEvent } from "@/lib/realtime/broadcast";
import { notifyOrderStatus } from "@/lib/notifications/notify";

type Ctx = { params: Promise<{ id: string }> };

// Customer (own order) or admin requests re-delivery for a FAILED order (a date
// within the next 3 days; max 3 attempts). The same agent keeps the job when
// they're free; otherwise auto-assign picks a new one (when enabled). Failing
// both, it stays RESCHEDULED for manual assignment.
export const POST = withApi(async (req: NextRequest, { params }: Ctx) => {
  const profile = await requireRole("CUSTOMER", "ADMIN");
  const { id } = await params;
  const { requestedDate, reason } = rescheduleSchema.parse(await req.json());

  if (!profile.roles.includes("ADMIN")) {
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
    actorRole: profile.roles.includes("ADMIN") ? "ADMIN" : "CUSTOMER",
  });

  let reassigned = false;
  // 1) Keep the same agent for continuity when they're available again.
  if (previousAgentId) {
    try {
      await assignAgent({
        orderId: id,
        mode: "MANUAL",
        agentId: previousAgentId,
        assignedById: profile.id,
      });
      reassigned = true;
    } catch {
      // Previous agent is busy/unavailable — fall through to auto-assign.
    }
  }
  // 2) Otherwise auto-assign a fresh agent, only when auto-assign is enabled.
  if (!reassigned && (await isAutoAssignEnabled())) {
    try {
      await assignAgent({ orderId: id, mode: "AUTO", assignedById: profile.id });
      reassigned = true;
    } catch {
      // No available agent — stays RESCHEDULED for manual assignment.
    }
  }

  const order = await prisma.order.findUniqueOrThrow({
    where: { id },
    select: { trackingNumber: true, status: true },
  });
  await broadcastOrderEvent(order.trackingNumber, { status: order.status });
  await notifyOrderStatus(id);

  return NextResponse.json({ data: { reassigned, status: order.status } });
});
