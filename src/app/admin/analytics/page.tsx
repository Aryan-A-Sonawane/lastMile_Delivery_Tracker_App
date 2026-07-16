"use client";

import { useMemo, useState } from "react";
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
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const C = {
  blue: "#2a78d6",
  aqua: "#1baf7a",
  orange: "#eb6834",
  axis: "#898781",
  grid: "#8888881f",
};
const tooltipStyle = {
  background: "var(--popover, #fff)",
  border: "1px solid #e1e0d9",
  borderRadius: 8,
  fontSize: 12,
  color: "#0b0b0b",
};

type Analytics = {
  period: { from: string; to: string; granularity: string };
  kpis: {
    totalOrders: number;
    totalRevenue: number;
    delivered: number;
    failedAttempts: number;
    inFlight: number;
    avgOrderValue: number;
    deltas: { totalOrders: number; totalRevenue: number; delivered: number; avgOrderValue: number };
  };
  timeseries: { bucket: string; orders: number; revenue: number; delivered: number }[];
  byStatus: { status: string; count: number }[];
  paymentSplit: { paymentType: string; count: number; revenue: number }[];
  byZone: { zone: string; count: number }[];
  failedReasons: { reason: string; count: number }[];
  topAgents: { name: string; delivered: number }[];
};

const PRESET_DAYS: Record<string, number> = { "7d": 7, "30d": 30, "90d": 90 };

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64">{children}</CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [preset, setPreset] = useState("30d");
  const [granularity, setGranularity] = useState("day");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(() => {
    const end = new Date();
    if (preset === "ytd") return { from: new Date(end.getFullYear(), 0, 1), to: end };
    if (preset === "custom" && customFrom && customTo)
      return { from: new Date(customFrom), to: new Date(customTo) };
    const days = PRESET_DAYS[preset] ?? 30;
    return { from: new Date(end.getTime() - days * 86_400_000), to: end };
  }, [preset, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", from.toISOString(), to.toISOString(), granularity],
    queryFn: () =>
      api.get<{ data: Analytics }>(
        `/api/admin/analytics?from=${from.toISOString()}&to=${to.toISOString()}&granularity=${granularity}`,
      ),
    refetchInterval: 60_000,
  });

  const a = data?.data;
  const statusData = (a?.byStatus ?? []).map((s) => ({ name: STATUS_LABELS[s.status] ?? s.status, count: s.count }));
  const zoneData = (a?.byZone ?? []).map((z) => ({ name: z.zone, count: z.count }));
  const reasonData = (a?.failedReasons ?? []).map((r) => ({ name: r.reason.replaceAll("_", " ").toLowerCase(), count: r.count }));
  const paymentData = (a?.paymentSplit ?? []).map((pp) => ({ name: pp.paymentType, value: pp.count }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Analytics"
        description="Operational performance across orders, revenue, agents and zones."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {preset === "custom" && (
              <>
                <Input type="date" className="w-36" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                <Input type="date" className="w-36" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
              </>
            )}
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
            <Select value={granularity} onValueChange={setGranularity}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading || !a ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <StatCard label="Orders" value={a.kpis.totalOrders} delta={a.kpis.deltas.totalOrders} href="/admin/orders" />
            <StatCard label="Revenue" value={formatMoney(a.kpis.totalRevenue)} delta={a.kpis.deltas.totalRevenue} />
            <StatCard label="Delivered" value={a.kpis.delivered} delta={a.kpis.deltas.delivered} href="/admin/orders?status=DELIVERED" />
            <StatCard label="Avg order value" value={formatMoney(a.kpis.avgOrderValue)} delta={a.kpis.deltas.avgOrderValue} />
            <StatCard label="Failed attempts" value={a.kpis.failedAttempts} />
            <StatCard label="In flight" value={a.kpis.inFlight} href="/admin/orders" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Orders">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a.timeseries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.blue} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.blue} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis allowDecimals={false} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="orders" stroke={C.blue} strokeWidth={2} fill="url(#gOrders)" />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Revenue">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={a.timeseries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.aqua} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={C.aqua} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={C.grid} vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatMoney(Number(v))} />
                  <Area type="monotone" dataKey="revenue" stroke={C.aqua} strokeWidth={2} fill="url(#gRev)" />
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
                  <Bar dataKey="count" fill={C.blue} radius={[0, 4, 4, 0]} barSize={13}>
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
                  <Bar dataKey="count" fill={C.blue} radius={[0, 4, 4, 0]} barSize={13}>
                    <LabelList dataKey="count" position="right" fill={C.axis} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Top agents (delivered)</CardTitle>
              </CardHeader>
              <CardContent className="h-64 overflow-y-auto">
                {a.topAgents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No deliveries in this period.</p>
                ) : (
                  <ol className="flex flex-col gap-1.5">
                    {a.topAgents.map((ag, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 truncate">
                          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                          <span className="truncate">{ag.name}</span>
                        </span>
                        <span className="tabular-nums font-medium">{ag.delivered}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>

            {reasonData.length > 0 && (
              <ChartCard title="Failed delivery reasons" className="lg:col-span-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reasonData} layout="vertical" margin={{ top: 4, right: 24, left: 24, bottom: 0 }}>
                    <CartesianGrid stroke={C.grid} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={140} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: C.grid }} />
                    <Bar dataKey="count" fill={C.orange} radius={[0, 4, 4, 0]} barSize={13}>
                      <LabelList dataKey="count" position="right" fill={C.axis} fontSize={11} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </>
      )}
    </div>
  );
}
