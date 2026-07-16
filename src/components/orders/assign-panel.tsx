"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, MapPin, Star } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { loadColor, type AgentPin } from "./agent-load";

const AgentAssignMap = dynamic(() => import("./agent-assign-map"), {
  ssr: false,
  loading: () => <div className="h-[380px] w-full animate-pulse rounded-lg bg-muted" />,
});

type Option = {
  agentId: string;
  name: string;
  phone: string | null;
  status: string;
  activeOrders: number;
  maxActiveOrders: number;
  loadFactor: number;
  lat: number | null;
  lng: number | null;
  usingLiveLocation: boolean;
  homeZoneCode: string | null;
  homeZoneName: string | null;
  available: boolean;
  score: number | null;
  distanceKm: number | null;
  sameZone: boolean;
  reason: string;
};

type Candidates = {
  pickup: { lat: number; lng: number } | null;
  drop: { lat: number; lng: number } | null;
  options: Option[];
};

type ScoredReason = { reason?: string; score?: number; method?: string };

function AgentRow({
  o,
  selected,
  onSelect,
  rank,
}: {
  o: Option;
  selected: boolean;
  onSelect: () => void;
  rank?: number;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!o.available}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "hover:bg-muted/50",
        !o.available && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className="mt-1 size-2.5 shrink-0 rounded-full"
        style={{ background: loadColor(o.loadFactor, o.available) }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {rank != null && <Star className="size-3 text-amber-500" fill="currentColor" />}
          <span className="truncate">{o.name}</span>
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {o.activeOrders}/{o.maxActiveOrders}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {o.homeZoneCode ?? "—"}
          {o.distanceKm != null ? ` · ${o.distanceKm} km` : ""}
          {o.score != null ? ` · score ${o.score}` : ""}
          {!o.available ? ` · ${o.status.toLowerCase()}` : ""}
        </span>
      </span>
    </button>
  );
}

export function AssignPanel({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastReason, setLastReason] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["assign-candidates", orderId],
    queryFn: () => api.get<{ data: Candidates }>(`/api/orders/${orderId}/candidates`),
  });

  const assign = useMutation({
    mutationFn: (payload: { mode: "MANUAL" | "AUTO"; agentId?: string }) =>
      api.post<{ data: { agentId: string; method: string; reason: ScoredReason } }>(
        `/api/orders/${orderId}/assign`,
        payload,
      ),
    onSuccess: (res) => {
      const r = res.data.reason;
      setLastReason(
        res.data.method === "AUTO" && r?.reason
          ? `Auto: ${r.reason}${r.score != null ? ` (score ${r.score})` : ""}`
          : "Manually assigned",
      );
      toast.success("Agent assigned");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["assign-candidates", orderId] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const options = data?.data.options ?? [];
  const pickup = data?.data.pickup ?? null;
  const available = options.filter((o) => o.available);
  const suggestions = available.filter((o) => o.score != null).slice(0, 3);
  const pins: AgentPin[] = options
    .filter((o) => o.lat != null && o.lng != null)
    .map((o) => ({
      agentId: o.agentId,
      name: o.name,
      lat: o.lat as number,
      lng: o.lng as number,
      loadFactor: o.loadFactor,
      available: o.available,
      activeOrders: o.activeOrders,
      maxActiveOrders: o.maxActiveOrders,
      distanceKm: o.distanceKm,
    }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Assign agent</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button onClick={() => assign.mutate({ mode: "AUTO" })} disabled={assign.isPending}>
          <Zap className="size-4" /> Auto-assign best match
        </Button>

        {isLoading && <Skeleton className="h-[380px] w-full rounded-lg" />}

        {!isLoading && pins.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border">
              <AgentAssignMap
                pickup={pickup}
                agents={pins}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-[#16a34a]" /> light
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-[#d97706]" /> busy
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2.5 rounded-full bg-[#dc2626]" /> full
              </span>
              <span className="flex items-center gap-1">
                <span className="size-3 rotate-45 bg-[#2563eb]" /> pickup
              </span>
            </div>
          </>
        )}

        {suggestions.length > 0 && (
          <div className="grid gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Top suggestions</p>
            {suggestions.map((o, i) => (
              <AgentRow
                key={o.agentId}
                o={o}
                rank={i}
                selected={selectedId === o.agentId}
                onSelect={() => setSelectedId(o.agentId)}
              />
            ))}
          </div>
        )}

        {available.length > suggestions.length && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              All available agents ({available.length})
            </summary>
            <div className="mt-1.5 grid max-h-56 gap-1.5 overflow-y-auto">
              {available.map((o) => (
                <AgentRow
                  key={o.agentId}
                  o={o}
                  selected={selectedId === o.agentId}
                  onSelect={() => setSelectedId(o.agentId)}
                />
              ))}
            </div>
          </details>
        )}

        {!isLoading && available.length === 0 && (
          <p className="text-sm text-muted-foreground">No available agents right now.</p>
        )}

        <Button
          variant="secondary"
          disabled={!selectedId || assign.isPending}
          onClick={() => selectedId && assign.mutate({ mode: "MANUAL", agentId: selectedId })}
        >
          <MapPin className="size-4" />
          {selectedId
            ? `Assign ${options.find((o) => o.agentId === selectedId)?.name ?? "agent"}`
            : "Select an agent to assign"}
        </Button>

        {lastReason && <p className="text-xs text-muted-foreground">{lastReason}</p>}
      </CardContent>
    </Card>
  );
}
