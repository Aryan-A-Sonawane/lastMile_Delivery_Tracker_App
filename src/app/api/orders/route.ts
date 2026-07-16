import { type NextRequest, NextResponse, after } from "next/server";
import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProfile, requireRole } from "@/lib/auth/session";
import { withApi, badRequest } from "@/lib/api/errors";
import { orderCreateSchema } from "@/lib/validation/order";
import { createOrder } from "@/lib/orders/create-order";
import { autoAssignIfEnabled } from "@/lib/orders/auto-assign";
import { orderListInclude } from "@/lib/orders/includes";
import { notifyOrderStatus } from "@/lib/notifications/notify";
import { broadcastOrderEvent } from "@/lib/realtime/broadcast";

// List orders, scoped by the requested context (verified against capabilities).
// A user who is both a customer and an agent sees the right set per `scope`.
export const GET = withApi(async (req: NextRequest) => {
  const profile = await requireProfile();
  const params = req.nextUrl.searchParams;
  const caps = profile.roles;
  const isAdmin = caps.includes("ADMIN");

  const requested = params.get("scope");
  let scope: "customer" | "agent" | "admin";
  if (requested === "admin" && isAdmin) scope = "admin";
  else if (requested === "agent" && (caps.includes("AGENT") || isAdmin)) scope = "agent";
  else if (requested === "customer" && (caps.includes("CUSTOMER") || isAdmin)) scope = "customer";
  else scope = isAdmin ? "admin" : caps.includes("AGENT") ? "agent" : "customer";

  let where: Prisma.OrderWhereInput = {};

  if (scope === "customer") {
    // Admins land here only when *previewing* the customer view — show a
    // representative sample of real orders so the UI isn't empty (this is a
    // layout preview, not the admin's own account).
    where = isAdmin ? {} : { customerId: profile.id };
  } else if (scope === "agent") {
    if (isAdmin) {
      // Preview: show assigned orders so the agent's "my deliveries" is populated.
      where = { currentAgentId: { not: null } };
    } else {
      const agent = await prisma.agentProfile.findUnique({
        where: { profileId: profile.id },
        select: { id: true },
      });
      where = { currentAgentId: agent?.id ?? "__none__" };
    }
  } else {
    const status = params.get("status");
    const zoneId = params.get("zoneId");
    const agentId = params.get("agentId");
    where = {
      ...(status ? { status: status as OrderStatus } : {}),
      ...(zoneId ? { OR: [{ pickupZoneId: zoneId }, { dropZoneId: zoneId }] } : {}),
      ...(agentId ? { currentAgentId: agentId } : {}),
    };
  }

  const orders = await prisma.order.findMany({
    where,
    include: orderListInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ data: orders });
});

// Create an order (customer for self, or admin on behalf of a customer).
export const POST = withApi(async (req: NextRequest) => {
  const profile = await requireRole("CUSTOMER", "ADMIN");
  const input = orderCreateSchema.parse(await req.json());

  const actingAsAdmin = profile.roles.includes("ADMIN");
  let customerId: string;
  if (actingAsAdmin && input.customerId) {
    const customer = await prisma.profile.findUnique({
      where: { id: input.customerId },
      select: { id: true },
    });
    if (!customer) throw badRequest("customer not found");
    customerId = input.customerId;
  } else {
    customerId = profile.id;
  }

  const order = await createOrder({
    input,
    customerId,
    createdById: profile.id,
    createdByRole: customerId !== profile.id ? "ADMIN" : "CUSTOMER",
  });

  // Auto-assign to the best available agent when the toggle is ON (no-op when
  // OFF or when no agent is free — the order then waits for manual assignment).
  const assignedAgentId = await autoAssignIfEnabled(order.id, profile.id);
  const assigned = assignedAgentId
    ? await prisma.order.findUnique({ where: { id: order.id } })
    : null;

  // Notifications + realtime push are best-effort — send after the response.
  after(async () => {
    await notifyOrderStatus(order.id);
    if (assignedAgentId) {
      await broadcastOrderEvent(order.trackingNumber, { status: "ASSIGNED" });
      await notifyOrderStatus(order.id);
    }
  });

  return NextResponse.json({ data: assigned ?? order }, { status: 201 });
});
