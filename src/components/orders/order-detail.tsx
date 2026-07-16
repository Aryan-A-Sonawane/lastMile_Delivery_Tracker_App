"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { useOrderEvents } from "@/lib/realtime/use-order-events";
import type { RateBreakdown } from "@/lib/domain/rate-engine";
import type { QuoteResult } from "@/lib/orders/pricing";
import { QuoteBreakdown } from "@/components/quote/quote-breakdown";
import { AssignPanel } from "./assign-panel";
import { StatusUpdatePanel } from "./status-update-panel";
import { ReschedulePanel } from "./reschedule-panel";
import { OrderTimeline, type TimelineEntry } from "./order-timeline";
import { OrderStatusBadge } from "./status-badge";
import { OrderStatusBar } from "./order-status-bar";
import { TrackingMapCard } from "./tracking-map-card";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type OrderDetailData = {
  id: string;
  trackingNumber: string;
  status: string;
  orderType: string;
  paymentType: string;
  pickupAddress: string;
  pickupPincode: string;
  dropAddress: string;
  dropPincode: string;
  lengthCm: string;
  breadthCm: string;
  heightCm: string;
  actualWeightKg: string;
  volumetricWeightKg: string;
  billableWeightKg: string;
  chargeBreakdown: RateBreakdown;
  currency: string;
  createdAt: string;
  scheduledDate: string | null;
  attemptNumber: number;
  pickupZone?: { name: string; code: string; centerLat: number | null; centerLng: number | null } | null;
  dropZone?: { name: string; code: string; centerLat: number | null; centerLng: number | null } | null;
  currentAgent?: {
    currentLat: number | null;
    currentLng: number | null;
    serviceAddress: string | null;
    profile: { name: string; email: string | null; phone: string | null };
  } | null;
  customer?: { name: string; email: string; phone: string | null } | null;
  statusHistory: TimelineEntry[];
};

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

export function OrderDetail({
  orderId,
  backHref,
  showCustomer = false,
  canAssign = false,
  canReschedule = false,
  statusActorRole,
}: {
  orderId: string;
  backHref: string;
  showCustomer?: boolean;
  canAssign?: boolean;
  canReschedule?: boolean;
  statusActorRole?: "AGENT" | "ADMIN";
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => api.get<{ data: OrderDetailData }>(`/api/orders/${orderId}`),
    // Live updates: poll until the order reaches a terminal state.
    refetchInterval: (q) => {
      const s = q.state.data?.data?.status;
      return s === "DELIVERED" ? false : 8000;
    },
  });

  useOrderEvents(data?.data.trackingNumber, () =>
    qc.invalidateQueries({ queryKey: ["order", orderId] }),
  );

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;
  if (isError)
    return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const o = data.data;
  const quoteResult: QuoteResult = {
    pickupZoneId: "",
    dropZoneId: "",
    zoneType: o.chargeBreakdown.zoneType,
    breakdown: o.chargeBreakdown,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-lg font-semibold">{o.trackingNumber}</h1>
            <OrderStatusBadge status={o.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Created {formatDate(o.createdAt)}
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>← Back</Link>
        </Button>
      </div>

      <OrderStatusBar
        status={o.status}
        scheduledDate={o.scheduledDate}
        showCustomer={showCustomer}
        agent={
          o.currentAgent
            ? {
                name: o.currentAgent.profile.name,
                phone: o.currentAgent.profile.phone,
                email: o.currentAgent.profile.email,
                note: o.currentAgent.serviceAddress,
              }
            : null
        }
        customer={
          o.customer
            ? {
                name: o.customer.name,
                phone: o.customer.phone,
                email: o.customer.email,
              }
            : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Shipment</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info
                label={`Pickup · ${o.pickupZone?.name ?? ""} (${o.pickupPincode})`}
                value={o.pickupAddress}
              />
              <Info
                label={`Drop · ${o.dropZone?.name ?? ""} (${o.dropPincode})`}
                value={o.dropAddress}
              />
              <Info label="Order type" value={`${o.orderType} · ${o.paymentType}`} />
              <Info
                label="Dimensions (L×B×H)"
                value={`${o.lengthCm} × ${o.breadthCm} × ${o.heightCm} cm`}
              />
              <Info label="Actual weight" value={`${o.actualWeightKg} kg`} />
              <Info label="Billable weight" value={`${o.billableWeightKg} kg`} />
              {showCustomer && o.customer && (
                <Info
                  label="Customer"
                  value={`${o.customer.name} · ${o.customer.email}`}
                />
              )}
              <Info label="Agent" value={o.currentAgent?.profile.name ?? "Unassigned"} />
            </CardContent>
          </Card>

          <TrackingMapCard
            pickupZone={o.pickupZone}
            dropZone={o.dropZone}
            currentAgent={o.currentAgent}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tracking timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <OrderTimeline history={o.statusHistory} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {canReschedule && o.status === "FAILED" && (
            <ReschedulePanel orderId={o.id} attemptNumber={o.attemptNumber} />
          )}
          {canAssign && ["CREATED", "RESCHEDULED"].includes(o.status) && (
            <AssignPanel orderId={o.id} />
          )}
          {statusActorRole && (
            <StatusUpdatePanel
              orderId={o.id}
              currentStatus={o.status}
              actorRole={statusActorRole}
            />
          )}
          <QuoteBreakdown result={quoteResult} />
        </div>
      </div>
    </div>
  );
}
