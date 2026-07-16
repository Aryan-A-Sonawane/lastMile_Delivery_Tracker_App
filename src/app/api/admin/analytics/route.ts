import { type NextRequest, NextResponse } from "next/server";
import type { Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const IN_FLIGHT: OrderStatus[] = [
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "RESCHEDULED",
];
const DAY = 86_400_000;

function pctDelta(cur: number, prev: number): number {
  if (prev === 0) return cur === 0 ? 0 : 100;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

async function periodAgg(where: Prisma.OrderWhereInput) {
  const [total, rev, delivered, inFlight] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.aggregate({ _sum: { totalCharge: true }, where }),
    prisma.order.count({ where: { ...where, status: "DELIVERED" } }),
    prisma.order.count({ where: { ...where, status: { in: IN_FLIGHT } } }),
  ]);
  const revenue = Number(rev._sum.totalCharge ?? 0);
  return { total, revenue, delivered, inFlight, avg: total ? revenue / total : 0 };
}

// Admin analytics for a selectable period + granularity, with period-over-period deltas.
export const GET = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const p = req.nextUrl.searchParams;

  const to = p.get("to") ? new Date(p.get("to")!) : new Date();
  const from = p.get("from")
    ? new Date(p.get("from")!)
    : new Date(to.getTime() - 30 * DAY);
  const gRaw = p.get("granularity") ?? "day";
  const granularity = ["day", "week", "month"].includes(gRaw) ? gRaw : "day";

  const span = Math.max(to.getTime() - from.getTime(), DAY);
  const prevFrom = new Date(from.getTime() - span);
  const where: Prisma.OrderWhereInput = { createdAt: { gte: from, lte: to } };
  const prevWhere: Prisma.OrderWhereInput = { createdAt: { gte: prevFrom, lt: from } };

  const [cur, prev, failedAttempts, byStatus, byPayment, byZoneRaw, zones, failedReasons, timeseries, topAgentsRaw] =
    await Promise.all([
      periodAgg(where),
      periodAgg(prevWhere),
      prisma.orderStatusHistory.count({
        where: { status: "FAILED", createdAt: { gte: from, lte: to } },
      }),
      prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } }),
      prisma.order.groupBy({
        by: ["paymentType"],
        where,
        _count: { _all: true },
        _sum: { totalCharge: true },
      }),
      prisma.order.groupBy({ by: ["pickupZoneId"], where, _count: { _all: true } }),
      prisma.zone.findMany({ select: { id: true, code: true } }),
      prisma.orderStatusHistory.groupBy({
        by: ["reason"],
        where: { status: "FAILED", createdAt: { gte: from, lte: to } },
        _count: { _all: true },
      }),
      prisma.$queryRaw<
        { bucket: Date; orders: bigint; revenue: number; delivered: bigint }[]
      >`
        SELECT date_trunc(${granularity}, "createdAt")::date AS bucket,
               count(*) AS orders,
               COALESCE(sum("totalCharge"), 0)::float AS revenue,
               count(*) FILTER (WHERE status = 'DELIVERED') AS delivered
        FROM orders
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY bucket ORDER BY bucket ASC`,
      prisma.order.groupBy({
        by: ["currentAgentId"],
        where: { ...where, status: "DELIVERED", currentAgentId: { not: null } },
        _count: { _all: true },
      }),
    ]);

  const zoneCode = (id: string) => zones.find((z) => z.id === id)?.code ?? id;

  // Resolve top-agent names.
  const topIds = topAgentsRaw
    .sort((a, b) => b._count._all - a._count._all)
    .slice(0, 8)
    .map((r) => r.currentAgentId!)
    .filter(Boolean);
  const agentProfiles = topIds.length
    ? await prisma.agentProfile.findMany({
        where: { id: { in: topIds } },
        select: { id: true, profile: { select: { name: true } } },
      })
    : [];
  const agentName = (id: string) =>
    agentProfiles.find((a) => a.id === id)?.profile.name ?? "—";

  return NextResponse.json({
    data: {
      period: { from: from.toISOString(), to: to.toISOString(), granularity },
      kpis: {
        totalOrders: cur.total,
        totalRevenue: Math.round(cur.revenue * 100) / 100,
        delivered: cur.delivered,
        failedAttempts,
        inFlight: cur.inFlight,
        avgOrderValue: Math.round(cur.avg * 100) / 100,
        deltas: {
          totalOrders: pctDelta(cur.total, prev.total),
          totalRevenue: pctDelta(cur.revenue, prev.revenue),
          delivered: pctDelta(cur.delivered, prev.delivered),
          avgOrderValue: pctDelta(cur.avg, prev.avg),
        },
      },
      timeseries: timeseries.map((r) => ({
        bucket: new Date(r.bucket).toISOString().slice(0, 10),
        orders: Number(r.orders),
        revenue: Number(r.revenue),
        delivered: Number(r.delivered),
      })),
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
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      failedReasons: failedReasons.map((r) => ({
        reason: r.reason ?? "OTHER",
        count: r._count._all,
      })),
      topAgents: topIds.map((id) => ({
        name: agentName(id),
        delivered: topAgentsRaw.find((r) => r.currentAgentId === id)?._count._all ?? 0,
      })),
    },
  });
});
