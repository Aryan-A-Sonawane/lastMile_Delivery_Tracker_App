"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Pencil, Trash2, Plus, X } from "lucide-react";
import { api } from "@/lib/api-client";
import type { ZoneCircleView } from "@/components/admin/zone-map";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ZoneMap = dynamic(() => import("@/components/admin/zone-map"), {
  ssr: false,
  loading: () => <Skeleton className="h-105 w-full rounded-lg" />,
});

type Zone = {
  id: string;
  name: string;
  code: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: string | null;
  _count?: { areas: number };
};
type Setting = { key: string; value: string };

type Draft = {
  id?: string;
  name: string;
  code: string;
  radiusKm: string;
  lat: number | null; // null until a center is placed on the map
  lng: number | null;
};

export default function ZonesPage() {
  const qc = useQueryClient();
  // draft === null → view-only (map clicks do nothing). Non-null → placing/editing.
  const [draft, setDraft] = useState<Draft | null>(null);

  const { data: zonesData, isLoading } = useQuery({
    queryKey: ["zones"],
    queryFn: () => api.get<{ data: Zone[] }>("/api/admin/zones"),
  });
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ data: Setting[] }>("/api/admin/settings"),
  });

  const defaultRadius = Number(
    settingsData?.data.find((s) => s.key === "defaultZoneRadiusKm")?.value ?? 12,
  );

  const zones = useMemo(() => zonesData?.data ?? [], [zonesData]);
  const circles: ZoneCircleView[] = useMemo(
    () =>
      zones
        .filter((z) => z.centerLat != null && z.centerLng != null)
        .map((z) => ({
          id: z.id,
          name: z.name,
          code: z.code,
          centerLat: z.centerLat as number,
          centerLng: z.centerLng as number,
          radiusKm: z.radiusKm != null ? Number(z.radiusKm) : defaultRadius,
        })),
    [zones, defaultRadius],
  );

  const save = useMutation({
    mutationFn: (d: Draft) => {
      const payload = {
        name: d.name,
        code: d.code,
        radiusKm: Number(d.radiusKm),
        centerLat: d.lat,
        centerLng: d.lng,
      };
      return d.id
        ? api.patch(`/api/admin/zones/${d.id}`, payload)
        : api.post("/api/admin/zones", payload);
    },
    onSuccess: () => {
      toast.success("Zone saved");
      qc.invalidateQueries({ queryKey: ["zones"] });
      setDraft(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/zones/${id}`),
    onSuccess: () => {
      toast.success("Zone deleted");
      qc.invalidateQueries({ queryKey: ["zones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const placing = draft !== null;
  const placed = draft?.lat != null && draft?.lng != null;
  const canSave = placing && placed && !!draft?.name.trim() && !!draft?.code.trim();

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Zones"
        description="View delivery zones on the map. Add a new one with New zone, then click the map to place its center."
        actions={
          <Button
            size="sm"
            variant={placing ? "secondary" : "default"}
            onClick={() =>
              setDraft(
                placing
                  ? null
                  : { name: "", code: "", radiusKm: String(defaultRadius), lat: null, lng: null },
              )
            }
          >
            {placing ? (
              <>
                <X className="size-4" /> Cancel
              </>
            ) : (
              <>
                <Plus className="size-4" /> New zone
              </>
            )}
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-2">
          {placing && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary">
              <MapPin className="size-4 shrink-0" />
              {placed
                ? "Click the map again to move the center."
                : "Click anywhere on the map to place the zone center."}
            </div>
          )}
          <Card>
            <CardContent className="p-2">
              <ZoneMap
                zones={circles}
                draft={
                  placing && placed
                    ? { lat: draft!.lat as number, lng: draft!.lng as number, radiusKm: Number(draft!.radiusKm) || defaultRadius }
                    : null
                }
                // Map clicks only do something while adding/editing a zone.
                onPick={
                  placing
                    ? (lat, lng) => setDraft((d) => (d ? { ...d, lat, lng } : d))
                    : undefined
                }
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3">
          {/* Draft editor (new / edit) */}
          {placing && draft && (
            <Card className="border-primary">
              <CardContent className="grid gap-3 p-4">
                <p className="text-sm font-medium">{draft.id ? "Edit zone" : "New zone"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="z-name">Name</Label>
                    <Input
                      id="z-name"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      placeholder="North Bengaluru"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="z-code">Code</Label>
                    <Input
                      id="z-code"
                      value={draft.code}
                      onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                      placeholder="BLR-N"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="z-radius">Radius (km)</Label>
                  <Input
                    id="z-radius"
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={draft.radiusKm}
                    onChange={(e) => setDraft({ ...draft, radiusKm: e.target.value })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {placed
                    ? `Center: ${(draft.lat as number).toFixed(4)}, ${(draft.lng as number).toFixed(4)}`
                    : "No center yet — click the map to place it."}
                </p>
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={!canSave || save.isPending} onClick={() => save.mutate(draft)}>
                    {save.isPending ? "Saving…" : "Save zone"}
                  </Button>
                  <Button variant="outline" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Existing zones */}
          {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
          {!isLoading && zones.length === 0 && !placing && (
            <EmptyState
              icon={<MapPin className="size-6" />}
              title="No zones yet"
              description="Click New zone, then click the map to place your first zone."
            />
          )}
          {zones.map((z) => (
            <Card key={z.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {z.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">{z.code}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {z._count?.areas ?? 0} areas ·{" "}
                    {z.radiusKm != null ? Number(z.radiusKm) : defaultRadius} km
                    {z.centerLat == null && " · no center"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Edit"
                    onClick={() =>
                      setDraft({
                        id: z.id,
                        name: z.name,
                        code: z.code,
                        radiusKm: String(z.radiusKm != null ? Number(z.radiusKm) : defaultRadius),
                        lat: z.centerLat,
                        lng: z.centerLng,
                      })
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() => {
                      if (confirm(`Delete zone ${z.name}? Its areas will be removed.`))
                        del.mutate(z.id);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
