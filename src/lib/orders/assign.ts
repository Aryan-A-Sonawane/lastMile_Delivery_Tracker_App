import { Prisma, type Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  selectAgent,
  type AgentCandidate,
  type ScoredAgent,
} from "@/lib/domain/assignment";
import { assertTransition } from "@/lib/domain/status-machine";
import { badRequest, conflict, notFound } from "@/lib/api/errors";

type AssignArgs = {
  orderId: string;
  mode: "MANUAL" | "AUTO";
  agentId?: string; // required for MANUAL
  assignedById: string; // admin profile id (null actor for pure SYSTEM)
  excludeAgentId?: string; // for reassignment: exclude the previous/failed agent
};

export type AssignResult = {
  order: Order;
  agentId: string;
  method: "MANUAL" | "AUTO";
  reason: ScoredAgent | { method: "MANUAL" };
};

// Statuses from which an order may be (re)assigned.
const ASSIGNABLE = new Set(["CREATED", "RESCHEDULED"]);

/**
 * Assigns an agent to an order. AUTO mode ranks available agents with the pure
 * scoring engine and picks the best; MANUAL takes a given agentId. The claim is
 * an atomic conditional UPDATE (increment activeOrders only while below
 * capacity) so two concurrent assignments can never over-book an agent.
 */
export async function assignAgent({
  orderId,
  mode,
  agentId,
  assignedById,
  excludeAgentId,
}: AssignArgs): Promise<AssignResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw notFound("Order not found");
  if (!ASSIGNABLE.has(order.status)) {
    throw conflict(`Order in status ${order.status} cannot be assigned`);
  }

  let chosenAgentId: string;
  let reason: AssignResult["reason"];

  if (mode === "AUTO") {
    const candidates = await prisma.agentProfile.findMany({
      where: {
        status: "AVAILABLE",
        ...(excludeAgentId ? { id: { not: excludeAgentId } } : {}),
      },
    });

    const mapped: AgentCandidate[] = candidates.map((a) => ({
      agentId: a.id,
      location:
        a.currentLat != null && a.currentLng != null
          ? { lat: a.currentLat, lng: a.currentLng }
          : null,
      homeZoneId: a.homeZoneId,
      activeOrders: a.activeOrders,
      maxActiveOrders: a.maxActiveOrders,
    }));

    const { best } = selectAgent(mapped, {
      pickup:
        order.pickupLat != null && order.pickupLng != null
          ? { lat: order.pickupLat, lng: order.pickupLng }
          : null,
      pickupZoneId: order.pickupZoneId,
    });

    if (!best) throw conflict("No available agent to auto-assign");
    chosenAgentId = best.agentId;
    reason = best;
  } else {
    if (!agentId) throw badRequest("agentId is required for manual assignment");
    chosenAgentId = agentId;
    reason = { method: "MANUAL" };
  }

  const updated = await prisma.$transaction(async (tx) => {
    // Atomic claim: only succeeds if the agent is AVAILABLE and below capacity.
    const claimed = await tx.$executeRaw`
      UPDATE agent_profiles
      SET "activeOrders" = "activeOrders" + 1, "updatedAt" = now()
      WHERE id = ${chosenAgentId}
        AND status = 'AVAILABLE'::"AgentStatus"
        AND "activeOrders" < "maxActiveOrders"`;
    if (claimed !== 1) {
      throw conflict("Selected agent is no longer available");
    }

    // If the agent just reached capacity, flip them to BUSY.
    const agent = await tx.agentProfile.findUniqueOrThrow({
      where: { id: chosenAgentId },
    });
    if (agent.activeOrders >= agent.maxActiveOrders) {
      await tx.agentProfile.update({
        where: { id: chosenAgentId },
        data: { status: "BUSY" },
      });
    }

    assertTransition(order.status, "ASSIGNED", "ADMIN");

    const o = await tx.order.update({
      where: { id: orderId },
      data: { currentAgentId: chosenAgentId, status: "ASSIGNED" },
    });

    await tx.assignment.create({
      data: {
        orderId,
        agentId: chosenAgentId,
        assignedById,
        method: mode,
        reason: reason as unknown as Prisma.InputJsonValue,
        attemptNumber: order.attemptNumber,
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId,
        status: "ASSIGNED",
        actorId: assignedById,
        actorRole: mode === "AUTO" ? "SYSTEM" : "ADMIN",
        note:
          mode === "AUTO"
            ? "Auto-assigned to nearest available agent"
            : "Manually assigned",
      },
    });

    return o;
  });

  return { order: updated, agentId: chosenAgentId, method: mode, reason };
}
