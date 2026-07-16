import { prisma } from "@/lib/prisma";
import { assignAgent } from "./assign";
import { broadcastOrderEvent } from "@/lib/realtime/broadcast";
import { notifyOrderStatus } from "@/lib/notifications/notify";

export const AUTO_ASSIGN_KEY = "autoAssignEnabled";

/** Whether new orders are auto-assigned. Defaults OFF when the setting is absent. */
export async function isAutoAssignEnabled(): Promise<boolean> {
  const s = await prisma.setting.findUnique({ where: { key: AUTO_ASSIGN_KEY } });
  return s ? s.value.trim().toLowerCase() === "true" : false;
}

/**
 * If auto-assign is enabled, try to assign a freshly-created / rescheduled order
 * to the best available agent. No-ops when disabled or when no agent is
 * available (the order stays pending for manual assignment). Returns the
 * assigned agentId, or null.
 */
export async function autoAssignIfEnabled(
  orderId: string,
  assignedById: string,
): Promise<string | null> {
  if (!(await isAutoAssignEnabled())) return null;
  try {
    const { agentId } = await assignAgent({ orderId, mode: "AUTO", assignedById });
    return agentId;
  } catch {
    return null; // no available agent, or order not in an assignable state
  }
}

/**
 * Sweep every unassigned pending order (CREATED / RESCHEDULED with no agent) and
 * auto-assign each. Called when the admin flips auto-assign ON. Broadcasts +
 * notifies for each order that gets assigned. Returns counts.
 */
export async function sweepPendingAssignments(
  assignedById: string,
): Promise<{ assigned: number; pending: number }> {
  const orders = await prisma.order.findMany({
    where: { status: { in: ["CREATED", "RESCHEDULED"] }, currentAgentId: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  let assigned = 0;
  for (const o of orders) {
    try {
      const result = await assignAgent({
        orderId: o.id,
        mode: "AUTO",
        assignedById,
      });
      assigned++;
      await broadcastOrderEvent(result.order.trackingNumber, {
        status: result.order.status,
      });
      await notifyOrderStatus(result.order.id);
    } catch {
      // No agent available right now — leave it pending for manual assignment.
    }
  }
  return { assigned, pending: orders.length - assigned };
}
