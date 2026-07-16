import type {
  ActorRole,
  FailureReason,
  Order,
  OrderStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { assertTransition } from "@/lib/domain/status-machine";
import { notFound } from "@/lib/api/errors";

type UpdateStatusArgs = {
  orderId: string;
  toStatus: OrderStatus;
  actorProfileId: string | null; // null for SYSTEM-driven transitions
  actorRole: Extract<ActorRole, "AGENT" | "ADMIN" | "SYSTEM">;
  note?: string;
  reason?: FailureReason;
  lat?: number;
  lng?: number;
};

// Statuses in which an order still occupies the agent's active-order capacity.
const OCCUPIES_AGENT = new Set<OrderStatus>([
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
]);

/**
 * Applies a status transition: validates it against the state machine (admins
 * may override), appends an immutable history row, and — on terminal statuses —
 * decrements the assigned agent's active-order count (flipping BUSY→AVAILABLE
 * when capacity frees up). All in one transaction.
 */
export async function updateOrderStatus({
  orderId,
  toStatus,
  actorProfileId,
  actorRole,
  note,
  reason,
  lat,
  lng,
}: UpdateStatusArgs): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order not found");

  // Throws InvalidTransitionError (→ 409) for illegal moves; admin can override.
  assertTransition(order.status, toStatus, actorRole);

  // Leaving an occupying status for a non-occupying one frees the agent's slot.
  const freesAgent =
    OCCUPIES_AGENT.has(order.status) && !OCCUPIES_AGENT.has(toStatus);
  // On return-to-sender the order is no longer anyone's to handle.
  const clearsAgent = toStatus === "RETURN_TO_SENDER";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: toStatus,
        ...(clearsAgent ? { currentAgentId: null } : {}),
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: toStatus,
        actorId: actorProfileId,
        actorRole,
        note: note ?? null,
        reason: toStatus === "FAILED" ? (reason ?? "OTHER") : null,
        lat: lat ?? null,
        lng: lng ?? null,
      },
    });

    if (freesAgent && order.currentAgentId) {
      // Single round trip: decrement load and free a BUSY agent when it drops
      // below capacity (replaces a find + update).
      await tx.$executeRaw`
        UPDATE agent_profiles
        SET "activeOrders" = GREATEST("activeOrders" - 1, 0),
            status = CASE
              WHEN status = 'BUSY'::"AgentStatus" AND ("activeOrders" - 1) < "maxActiveOrders"
              THEN 'AVAILABLE'::"AgentStatus" ELSE status END,
            "updatedAt" = now()
        WHERE id = ${order.currentAgentId} AND "activeOrders" > 0`;
    }

    return updated;
  });
}
