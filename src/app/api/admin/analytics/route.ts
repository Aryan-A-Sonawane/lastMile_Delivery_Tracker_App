import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

// Aggregated metrics for the admin analytics dashboard.
export const GET = withApi(async () => {
  await requireRole("ADMIN");

  const [
    totalOrders,
    revenueAgg,
    byStatus,
    byPayment,
    byZoneRaw,
    zones,
    failedReasons,
    agentsAvailable,
    daily,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({ _sum: { totalCharge: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.groupBy({
      by: ["paymentType"],
      _count: { _all: true },
      _sum: { totalCharge: true },
    }),
    prisma.order.groupBy({ by: ["pickupZoneId"], _count: { _all: true } }),
    prisma.zone.findMany({ select: { id: true, code: true } }),
    prisma.orderStatusHistory.groupBy({
      by: ["reason"],
      where: { status: "FAILED" },
      _count: { _all: true },
    }),
    prisma.agentProfile.count({ where: { status: "AVAILABLE" } }),
    prisma.$queryRaw<{ day: Date; orders: bigint; revenue: number }[]>`
      SELECT date_trunc('day', "createdAt")::date AS day,
             count(*) AS orders,
             COALESCE(sum("totalCharge"), 0)::float AS revenue
      FROM orders
      WHERE "createdAt" >= now() - interval '14 days'
      GROUP BY day
      ORDER BY day ASC`,
  ]);

  const statusCount = (s: string) =>
    byStatus.find((r) => r.status === s)?._count._all ?? 0;
  const zoneCode = (id: string) => zones.find((z) => z.id === id)?.code ?? id;

  const inFlight = ["ASSIGNED", "PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].reduce(
    (n, s) => n + statusCount(s),
    0,
  );
  const failedAttempts = failedReasons.reduce((n, r) => n + r._count._all, 0);

  return NextResponse.json({
    data: {
      kpis: {
        totalOrders,
        totalRevenue: Number(revenueAgg._sum.totalCharge ?? 0),
        delivered: statusCount("DELIVERED"),
        inFlight,
        failedAttempts,
        agentsAvailable,
      },
      byStatus: byStatus
        .map((r) => ({ status: r.status, count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      paymentSplit: byPayment.map((r) => ({
        paymentType: r.paymentType,
        count: r._count._all,
        revenue: Number(r._sum.totalCharge ?? 0),
      })),
      byZone: byZoneRaw
        .map((r) => ({ zone: zoneCode(r.pickupZoneId), count: r._count._all }))
        .sort((a, b) => b.count - a.count),
      failedReasons: failedReasons.map((r) => ({
        reason: r.reason ?? "OTHER",
        count: r._count._all,
      })),
      daily: daily.map((r) => ({
        day: new Date(r.day).toISOString().slice(0, 10),
        orders: Number(r.orders),
        revenue: Number(r.revenue),
      })),
    },
  });
});
