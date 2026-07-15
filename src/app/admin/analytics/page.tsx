"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { STATUS_LABELS } from "@/components/orders/status-badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Validated categorical palette (dataviz skill reference instance).
const C = {
  blue: "#2a78d6",
  aqua: "#1baf7a",
  orange: "#eb6834",
  red: "#e34948",
  axis: "#898781",
  grid: "#8888881f",
};

type Analytics = {
  kpis: {
    totalOrders: number;
    totalRevenue: number;
    delivered: number;
    inFlight: number;
    failedAttempts: number;
    agentsAvailable: number;
  };
  byStatus: { status: string; count: number }[];
  paymentSplit: { paymentType: string; count: number; revenue: number }[];
  byZone: { zone: string; count: number }[];
  failedReasons: { reason: string; count: number }[];
  daily: { day: string; orders: number; revenue: number }[];
};

const tooltipStyle = {
  background: "var(--popover, #fff)",
  border: "1px solid #e1e0d9",
  borderRadius: 8,
  fontSize: 12,
  color: "#0b0b0b",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-normal text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => api.get<{ data: Analytics }>("/api/admin/analytics"),
    refetchInterval: 30_000,
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96 w-full rounded-lg" />;
  }

  const a = data.data;
  const statusData = a.byStatus.map((s) => ({
    name: STATUS_LABELS[s.status] ?? s.status,
    count: s.count,
  }));
  const zoneData = a.byZone.map((z) => ({ name: z.zone, count: z.count }));
  const reasonData = a.failedReasons.map((r) => ({
    name: r.reason.replaceAll("_", " ").toLowerCase(),
    count: r.count,
  }));
  const paymentData = a.paymentSplit.map((p) => ({
    name: p.paymentType,
    value: p.count,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Operational overview across orders, revenue, agents and zones.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total orders" value={a.kpis.totalOrders} />
        <Stat label="Revenue" value={formatMoney(a.kpis.totalRevenue)} />
        <Stat label="Delivered" value={a.kpis.delivered} />
        <Stat label="In flight" value={a.kpis.inFlight} />
        <Stat label="Failed attempts" value={a.kpis.failedAttempts} />
        <Stat label="Agents available" value={a.kpis.agentsAvailable} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Orders per day (14d)">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={a.daily} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="day" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="orders" stroke={C.blue} fill={C.blue} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue per day (14d)">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={a.daily} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="day" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
              <Area type="monotone" dataKey="revenue" stroke={C.aqua} fill={C.aqua} fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders by status">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData} layout="vertical" margin={{ top: 4, right: 24, left: 24, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={96} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: C.grid }} />
              <Bar dataKey="count" fill={C.blue} radius={[0, 4, 4, 0]} barSize={14}>
                <LabelList dataKey="count" position="right" fill={C.axis} fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Payment split">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} label={(e) => `${e.name}: ${e.value}`} labelLine={false} fontSize={12}>
                {paymentData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? C.blue : C.aqua} stroke="var(--card, #fff)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Orders by pickup zone">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={zoneData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid stroke={C.grid} horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={64} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: C.grid }} />
              <Bar dataKey="count" fill={C.blue} radius={[0, 4, 4, 0]} barSize={14}>
                <LabelList dataKey="count" position="right" fill={C.axis} fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Failed delivery reasons">
          <ResponsiveContainer width="100%" height="100%">
            {reasonData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No failed deliveries.
              </div>
            ) : (
              <BarChart data={reasonData} layout="vertical" margin={{ top: 4, right: 24, left: 24, bottom: 0 }}>
                <CartesianGrid stroke={C.grid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={120} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: C.grid }} />
                <Bar dataKey="count" fill={C.orange} radius={[0, 4, 4, 0]} barSize={14}>
                  <LabelList dataKey="count" position="right" fill={C.axis} fontSize={11} />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
