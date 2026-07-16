"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HeatMap = dynamic(() => import("@/components/admin/heat-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-130 w-full rounded-lg" />,
});

type Point = {
  lat: number;
  lng: number;
  pincode: string;
  name: string;
  orders: number;
  revenue: number;
  failed: number;
};
type Metric = "orders" | "failed" | "revenue";

const PRESET_DAYS: Record<string, number> = { "30d": 30, "90d": 90, "365d": 365 };

export default function HeatmapPage() {
  const [metric, setMetric] = useState<Metric>("orders");
  const [preset, setPreset] = useState("90d");

  const { from, to } = useMemo(() => {
    const end = new Date();
    const days = PRESET_DAYS[preset] ?? 90;
    return { from: new Date(end.getTime() - days * 86_400_000), to: end };
  }, [preset]);

  const { data, isLoading } = useQuery({
    queryKey: ["heatmap", from.toISOString(), to.toISOString()],
    queryFn: () =>
      api.get<{ data: Point[] }>(
        `/api/admin/analytics/heatmap?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
  });

  const points = data?.data ?? [];
  const heatPoints = points.map((p) => ({ lat: p.lat, lng: p.lng, value: p[metric] }));
  const max = Math.max(1, ...heatPoints.map((p) => p.value));
  const fmt = (n: number) => (metric === "revenue" ? formatMoney(n) : String(n));
  const top = [...points].sort((a, b) => b[metric] - a[metric]).slice(0, 8);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Heatmap"
        description="Geographic distribution of demand across serviceable areas."
        actions={
          <div className="flex flex-wrap gap-2">
            <Select value={metric} onValueChange={(v) => setMetric(v as Metric)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="orders">Orders placed</SelectItem>
                <SelectItem value="failed">Failed deliveries</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
              </SelectContent>
            </Select>
            <Select value={preset} onValueChange={setPreset}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="365d">Last year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <Card>
          <CardContent className="p-2">
            {isLoading ? (
              <Skeleton className="h-130 w-full rounded-lg" />
            ) : points.length === 0 ? (
              <div className="flex h-130 items-center justify-center text-sm text-muted-foreground">
                No orders in this period (or no serviceable areas with coordinates yet).
              </div>
            ) : (
              <>
                <HeatMap points={heatPoints} max={max} />
                <div className="flex items-center gap-3 px-2 py-3">
                  <span className="text-xs text-muted-foreground">Low</span>
                  <div
                    className="h-2.5 flex-1 rounded-full"
                    style={{ background: "linear-gradient(90deg,#2a78d6,#1baf7a,#eda100,#eb6834,#e34948)" }}
                  />
                  <span className="text-xs text-muted-foreground">{fmt(max)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium">Top areas</p>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data.</p>
            ) : (
              <ol className="flex flex-col gap-1.5">
                {top.map((pnt, i) => (
                  <li key={pnt.pincode} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{i + 1}</span>
                      <span className="truncate">{pnt.name}</span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{fmt(pnt[metric])}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
