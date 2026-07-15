import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApi, notFound } from "@/lib/api/errors";

type Ctx = { params: Promise<{ trackingNumber: string }> };

// Public shipment tracking — no auth, limited fields (no customer PII).
export const GET = withApi(async (_req: NextRequest, { params }: Ctx) => {
  const { trackingNumber } = await params;

  const order = await prisma.order.findUnique({
    where: { trackingNumber },
    select: {
      trackingNumber: true,
      status: true,
      orderType: true,
      createdAt: true,
      scheduledDate: true,
      pickupZone: { select: { name: true, centerLat: true, centerLng: true } },
      dropZone: { select: { name: true, centerLat: true, centerLng: true } },
      currentAgent: {
        select: {
          currentLat: true,
          currentLng: true,
          profile: { select: { name: true } },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
        select: { status: true, note: true, createdAt: true, actorRole: true },
      },
    },
  });

  if (!order) throw notFound("No shipment found for that tracking number");
  return NextResponse.json({ data: order });
});
