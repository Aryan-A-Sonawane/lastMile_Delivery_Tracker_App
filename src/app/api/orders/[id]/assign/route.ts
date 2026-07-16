import { type NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { assignAgent } from "@/lib/orders/assign";
import { broadcastOrderEvent } from "@/lib/realtime/broadcast";
import { notifyOrderStatus } from "@/lib/notifications/notify";

type Ctx = { params: Promise<{ id: string }> };

const assignSchema = z.object({
  mode: z.enum(["MANUAL", "AUTO"]).default("MANUAL"),
  agentId: z.string().optional(),
});

// Admin assigns an agent to an order — manually (agentId) or auto (nearest available).
export const POST = withApi(async (req: NextRequest, { params }: Ctx) => {
  const profile = await requireRole("ADMIN");
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { mode, agentId } = assignSchema.parse(body);

  const result = await assignAgent({
    orderId: id,
    mode,
    agentId,
    assignedById: profile.id,
  });

  after(async () => {
    await broadcastOrderEvent(result.order.trackingNumber, {
      status: result.order.status,
    });
    await notifyOrderStatus(result.order.id);
  });
  return NextResponse.json({ data: result });
});
