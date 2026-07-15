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
  actorProfileId: string;
  actorRole: Extract<ActorRole, "AGENT" | "ADMIN">;
  note?: string;
  reason?: FailureReason;
  lat?: number;
  lng?: number;
};

// Statuses that complete an attempt and free the assigned agent's capacity.
const FREES_AGENT = new Set<OrderStatus>(["DELIVERED", "FAILED"]);

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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: toStatus },
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

    if (FREES_AGENT.has(toStatus) && order.currentAgentId) {
      const agent = await tx.agentProfile.findUnique({
        where: { id: order.currentAgentId },
      });
      if (agent && agent.activeOrders > 0) {
        const activeOrders = agent.activeOrders - 1;
        await tx.agentProfile.update({
          where: { id: order.currentAgentId },
          data: {
            activeOrders,
            status:
              agent.status === "BUSY" && activeOrders < agent.maxActiveOrders
                ? "AVAILABLE"
                : agent.status,
          },
        });
      }
    }

    return updated;
  });
}
