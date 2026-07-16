import { Prisma, type Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  selectAgent,
  directionVector,
  type AgentCandidate,
  type ScoredAgent,
  type Vec2,
} from "@/lib/domain/assignment";
import { haversineKm } from "@/lib/domain/zones";
import { assertTransition } from "@/lib/domain/status-machine";
import { badRequest, conflict, notFound } from "@/lib/api/errors";

// Statuses that still occupy an agent's committed route (not yet delivered/closed).
const IN_FLIGHT = [
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
] as const;

/**
 * For each candidate agent, sum the route distance of their in-flight orders and
 * derive an aggregate heading (normalized sum of pickup→drop legs). Used by the
 * workload + direction-alignment scoring terms.
 */
async function loadAgentWorkload(agentIds: string[]): Promise<
  Map<string, { committedRouteKm: number; heading: Vec2 | null }>
> {
  const out = new Map<string, { committedRouteKm: number; heading: Vec2 | null }>();
  if (agentIds.length === 0) return out;

  const orders = await prisma.order.findMany({
    where: { currentAgentId: { in: agentIds }, status: { in: [...IN_FLIGHT] } },
    select: {
      currentAgentId: true,
      pickupLat: true,
      pickupLng: true,
      dropLat: true,
      dropLng: true,
    },
  });

  const acc = new Map<string, { km: number; x: number; y: number }>();
  for (const o of orders) {
    if (!o.currentAgentId) continue;
    if (o.pickupLat == null || o.pickupLng == null || o.dropLat == null || o.dropLng == null) {
      continue;
    }
    const pickup = { lat: o.pickupLat, lng: o.pickupLng };
    const drop = { lat: o.dropLat, lng: o.dropLng };
    const cur = acc.get(o.currentAgentId) ?? { km: 0, x: 0, y: 0 };
    cur.km += haversineKm(pickup, drop);
    const v = directionVector(pickup, drop);
    if (v) {
      cur.x += v.x;
      cur.y += v.y;
    }
    acc.set(o.currentAgentId, cur);
  }

  for (const [agentId, { km, x, y }] of acc) {
    const mag = Math.hypot(x, y);
    out.set(agentId, {
      committedRouteKm: km,
      heading: mag > 0 ? { x: x / mag, y: y / mag } : null,
    });
  }
  return out;
}

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

    const workload = await loadAgentWorkload(candidates.map((a) => a.id));

    const mapped: AgentCandidate[] = candidates.map((a) => ({
      agentId: a.id,
      location:
        a.currentLat != null && a.currentLng != null
          ? { lat: a.currentLat, lng: a.currentLng }
          : null,
      homeZoneId: a.homeZoneId,
      activeOrders: a.activeOrders,
      maxActiveOrders: a.maxActiveOrders,
      committedRouteKm: workload.get(a.id)?.committedRouteKm ?? 0,
      heading: workload.get(a.id)?.heading ?? null,
      rating: a.rating,
    }));

    const { best } = selectAgent(mapped, {
      pickup:
        order.pickupLat != null && order.pickupLng != null
          ? { lat: order.pickupLat, lng: order.pickupLng }
          : null,
      drop:
        order.dropLat != null && order.dropLng != null
          ? { lat: order.dropLat, lng: order.dropLng }
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
