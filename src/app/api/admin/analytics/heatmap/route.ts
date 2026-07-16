import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const DAY = 86_400_000;

// Per-pickup-area aggregates for the heatmap: orders, failed, revenue.
export const GET = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const p = req.nextUrl.searchParams;
  const to = p.get("to") ? new Date(p.get("to")!) : new Date();
  const from = p.get("from") ? new Date(p.get("from")!) : new Date(to.getTime() - 90 * DAY);

  const rows = await prisma.$queryRaw<
    { lat: number; lng: number; pincode: string; name: string; orders: bigint; revenue: number; failed: bigint }[]
  >`
    SELECT a.lat, a.lng, a.pincode, a.name,
           count(o.id) AS orders,
           COALESCE(sum(o."totalCharge"), 0)::float AS revenue,
           count(o.id) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM order_status_history h
               WHERE h."orderId" = o.id AND h.status = 'FAILED'
             )
           ) AS failed
    FROM areas a
    JOIN orders o ON o."pickupPincode" = a.pincode
    WHERE o."createdAt" >= ${from} AND o."createdAt" <= ${to}
      AND a.lat IS NOT NULL AND a.lng IS NOT NULL
    GROUP BY a.lat, a.lng, a.pincode, a.name`;

  const points = rows.map((r) => ({
    lat: r.lat,
    lng: r.lng,
    pincode: r.pincode,
    name: r.name,
    orders: Number(r.orders),
    revenue: Number(r.revenue),
    failed: Number(r.failed),
  }));

  return NextResponse.json({ data: points });
});
