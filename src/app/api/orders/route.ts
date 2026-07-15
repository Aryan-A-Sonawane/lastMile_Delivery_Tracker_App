import { type NextRequest, NextResponse } from "next/server";
import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireProfile, requireRole } from "@/lib/auth/session";
import { withApi, badRequest } from "@/lib/api/errors";
import { orderCreateSchema } from "@/lib/validation/order";
import { createOrder } from "@/lib/orders/create-order";
import { orderListInclude } from "@/lib/orders/includes";
import { notifyOrderStatus } from "@/lib/notifications/notify";

// List orders, scoped to the caller's role.
export const GET = withApi(async (req: NextRequest) => {
  const profile = await requireProfile();
  const params = req.nextUrl.searchParams;

  let where: Prisma.OrderWhereInput = {};

  if (profile.role === "CUSTOMER") {
    where = { customerId: profile.id };
  } else if (profile.role === "AGENT") {
    const agent = await prisma.agentProfile.findUnique({
      where: { profileId: profile.id },
      select: { id: true },
    });
    where = { currentAgentId: agent?.id ?? "__none__" };
  } else {
    // ADMIN — optional filters
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

  let customerId: string;
  if (profile.role === "ADMIN") {
    if (!input.customerId) {
      throw badRequest("customerId is required when an admin creates an order");
    }
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
    createdByRole: profile.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
  });

  await notifyOrderStatus(order.id);
  return NextResponse.json({ data: order }, { status: 201 });
});
