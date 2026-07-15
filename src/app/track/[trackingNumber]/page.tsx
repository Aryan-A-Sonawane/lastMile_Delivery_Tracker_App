"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useOrderEvents } from "@/lib/realtime/use-order-events";
import { OrderTimeline, type TimelineEntry } from "@/components/orders/order-timeline";
import { OrderStatusBadge } from "@/components/orders/status-badge";
import { TrackingMapCard } from "@/components/orders/tracking-map-card";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type TrackData = {
  trackingNumber: string;
  status: string;
  orderType: string;
  createdAt: string;
  scheduledDate: string | null;
  pickupZone?: { name: string; centerLat: number | null; centerLng: number | null } | null;
  dropZone?: { name: string; centerLat: number | null; centerLng: number | null } | null;
  currentAgent?: {
    currentLat: number | null;
    currentLng: number | null;
    profile: { name: string };
  } | null;
  statusHistory: TimelineEntry[];
};

export default function TrackPage({
  params,
}: {
  params: Promise<{ trackingNumber: string }>;
}) {
  const { trackingNumber } = use(params);
  const qc = useQueryClient();
  useOrderEvents(trackingNumber, () =>
    qc.invalidateQueries({ queryKey: ["track", trackingNumber] }),
  );
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["track", trackingNumber],
    queryFn: () => api.get<{ data: TrackData }>(`/api/track/${trackingNumber}`),
    retry: false,
    // Live updates: poll until the shipment reaches a terminal state.
    refetchInterval: (q) => {
      const s = q.state.data?.data?.status;
      return s === "DELIVERED" ? false : 5000;
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shipment tracking</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/track">New search</Link>
        </Button>
      </div>

      {isLoading && <Skeleton className="h-72 w-full rounded-lg" />}

      {isError && (
        <Card className="border-destructive/40">
          <CardContent className="py-6 text-center text-sm text-destructive">
            {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="font-mono text-base">
                  {data.data.trackingNumber}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {data.data.pickupZone?.name ?? "—"} →{" "}
                  {data.data.dropZone?.name ?? "—"}
                </p>
              </div>
              <OrderStatusBadge status={data.data.status} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              <span>Placed {formatDate(data.data.createdAt)}</span>
              {data.data.scheduledDate && (
                <span>Scheduled {formatDate(data.data.scheduledDate)}</span>
              )}
              {data.data.currentAgent && (
                <span>Agent: {data.data.currentAgent.profile.name}</span>
              )}
            </div>
            <TrackingMapCard
              pickupZone={data.data.pickupZone}
              dropZone={data.data.dropZone}
              currentAgent={data.data.currentAgent}
            />
            <OrderTimeline history={data.data.statusHistory} />
          </CardContent>
        </Card>
      )}
    </main>
  );
}
