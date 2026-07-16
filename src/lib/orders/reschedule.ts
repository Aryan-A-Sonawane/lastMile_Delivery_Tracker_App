import type { ActorRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTransition } from "@/lib/domain/status-machine";
import { hasAttemptsRemaining, MAX_DELIVERY_ATTEMPTS } from "./attempts";
import { conflict, notFound } from "@/lib/api/errors";

type RescheduleArgs = {
  orderId: string;
  requestedDate: Date;
  reason?: string;
  actorProfileId: string;
  actorRole: Extract<ActorRole, "CUSTOMER" | "ADMIN">;
};

/**
 * Reschedules a FAILED order: records the RescheduleRequest, moves the order to
 * RESCHEDULED with the new date, bumps the attempt counter and clears the
 * (already-freed) failed agent. Returns the previous agent id so the caller can
 * reassign while excluding them.
 */
export async function rescheduleOrder({
  orderId,
  requestedDate,
  reason,
  actorProfileId,
  actorRole,
}: RescheduleArgs): Promise<{ previousAgentId: string | null }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order not found");
  if (order.status !== "FAILED") {
    throw conflict("Only a failed delivery can be rescheduled");
  }
  if (!hasAttemptsRemaining(order.attemptNumber)) {
    throw conflict(
      `All ${MAX_DELIVERY_ATTEMPTS} delivery attempts have been used — this shipment is being returned to the sender.`,
    );
  }
  assertTransition("FAILED", "RESCHEDULED", actorRole);

  const previousAgentId = order.currentAgentId;

  await prisma.$transaction(async (tx) => {
    await tx.rescheduleRequest.create({
      data: {
        orderId,
        requestedDate,
        reason: reason ?? null,
        createdById: actorProfileId,
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "RESCHEDULED",
        scheduledDate: requestedDate,
        attemptNumber: { increment: 1 },
        currentAgentId: null,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "RESCHEDULED",
        actorId: actorProfileId,
        actorRole,
        note: `Rescheduled to ${requestedDate.toISOString().slice(0, 10)}`,
      },
    });
  });

  return { previousAgentId };
}
