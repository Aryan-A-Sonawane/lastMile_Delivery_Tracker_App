"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import type { ZoneCircleView } from "@/components/admin/zone-map";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  lat: number;
  lng: number;
};

export default function ZonesPage() {
  const qc = useQueryClient();
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

  function startEdit(z: Zone) {
    if (z.centerLat == null || z.centerLng == null) {
      toast.error("This zone has no center yet — click the map to set one.");
      return;
    }
    setDraft({
      id: z.id,
      name: z.name,
      code: z.code,
      radiusKm: String(z.radiusKm != null ? Number(z.radiusKm) : defaultRadius),
      lat: z.centerLat,
      lng: z.centerLng,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Zones"
        description="Click the map to drop a zone center. Radius defaults from Settings and is editable per zone."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="p-2">
            <ZoneMap
              zones={circles}
              draft={draft ? { lat: draft.lat, lng: draft.lng, radiusKm: Number(draft.radiusKm) || defaultRadius } : null}
              onPick={(lat, lng) =>
                setDraft((d) =>
                  d
                    ? { ...d, lat, lng }
                    : { name: "", code: "", radiusKm: String(defaultRadius), lat, lng },
                )
              }
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
          {!isLoading && zones.length === 0 && (
            <EmptyState
              icon={<MapPin className="size-6" />}
              title="No zones yet"
              description="Click anywhere on the map to place your first zone."
            />
          )}
          {zones.map((z) => (
            <Card key={z.id}>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {z.name}{" "}
                    <span className="font-mono text-xs text-muted-foreground">
                      {z.code}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {z._count?.areas ?? 0} areas ·{" "}
                    {z.radiusKm != null ? Number(z.radiusKm) : defaultRadius} km
                    {z.centerLat == null && " · no center"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(z)} aria-label="Edit">
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

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit zone" : "New zone"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(draft);
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="z-name">Name</Label>
                  <Input id="z-name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="z-code">Code</Label>
                  <Input id="z-code" required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="BLR-N" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="z-radius">Radius (km)</Label>
                <Input id="z-radius" type="number" step="0.5" min="0.5" required value={draft.radiusKm} onChange={(e) => setDraft({ ...draft, radiusKm: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                Center: {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)} — click the map to move it.
              </p>
              <DialogFooter>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Saving…" : "Save zone"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
