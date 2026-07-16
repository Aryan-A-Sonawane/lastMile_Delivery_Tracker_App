"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Crosshair } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const LocationPickerMap = dynamic(
  () => import("@/components/agent/location-picker-map"),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" /> },
);

type AgentProfile = {
  id: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
  serviceLat: number | null;
  serviceLng: number | null;
  serviceAddress: string | null;
  activeOrders: number;
  maxActiveOrders: number;
  homeZone: { name: string; code: string } | null;
  profile: { name: string; email: string; phone: string | null };
};

function ServingLocationForm({ agent }: { agent: AgentProfile }) {
  const qc = useQueryClient();
  const [lat, setLat] = useState(agent.serviceLat != null ? String(agent.serviceLat) : "");
  const [lng, setLng] = useState(agent.serviceLng != null ? String(agent.serviceLng) : "");
  const [address, setAddress] = useState(agent.serviceAddress ?? "");
  const [available, setAvailable] = useState(agent.status === "AVAILABLE");

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch<{ data: AgentProfile }>("/api/agent/profile", payload),
    onSuccess: () => {
      toast.success("Serving location saved");
      qc.invalidateQueries({ queryKey: ["agent-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const point =
    lat !== "" && lng !== "" && !Number.isNaN(+lat) && !Number.isNaN(+lng)
      ? { lat: +lat, lng: +lng }
      : null;

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not available in this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success("Filled from your current location");
      },
      () => toast.error("Could not read your location"),
    );
  };

  const onSave = () => {
    if (!point) {
      toast.error("Pick a location on the map or enter coordinates");
      return;
    }
    save.mutate({
      serviceLat: point.lat,
      serviceLng: point.lng,
      serviceAddress: address || null,
      status: available ? "AVAILABLE" : "OFFLINE",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Availability</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {available ? "You are available for new deliveries." : "You are offline — no new deliveries."}
            <span className="ml-1">
              ({agent.activeOrders}/{agent.maxActiveOrders} active)
            </span>
          </div>
          <Switch checked={available} onCheckedChange={setAvailable} aria-label="Availability" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-lg border">
          <LocationPickerMap
            value={point}
            onPick={(la, ln) => {
              setLat(la.toFixed(6));
              setLng(ln.toFixed(6));
            }}
          />
        </div>

        <div className="grid content-start gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="address">Address / landmark</Label>
            <Input
              id="address"
              placeholder="e.g. Sector 5 hub, Bengaluru"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="lat">Latitude</Label>
              <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lng">Longitude</Label>
              <Input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          <Button type="button" variant="outline" onClick={useMyLocation}>
            <Crosshair className="size-4" /> Use my current location
          </Button>
          <Button onClick={onSave} disabled={save.isPending || !point}>
            {save.isPending ? "Saving…" : "Save serving location"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Tip: click anywhere on the map to drop your serving point.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AgentServingLocationPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["agent-profile"],
    queryFn: () => api.get<{ data: AgentProfile }>("/api/agent/profile"),
  });
  const agent = data?.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Serving location</h1>
        <p className="text-sm text-muted-foreground">
          This is the fixed point new deliveries are matched to. Keep it accurate —
          it decides which jobs come your way.
        </p>
      </div>

      {isLoading && <Skeleton className="h-96 w-full rounded-lg" />}
      {!isLoading && !agent && (
        <p className="text-sm text-destructive">No agent profile found.</p>
      )}
      {agent && <ServingLocationForm key={agent.id} agent={agent} />}
    </div>
  );
}
