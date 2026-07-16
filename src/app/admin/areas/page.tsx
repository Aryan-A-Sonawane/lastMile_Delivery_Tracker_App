"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Search, Trash2, Pencil } from "lucide-react";
import { api } from "@/lib/api-client";
import { zoneForPoint, type ZoneCircle } from "@/lib/domain/zones";
import type { ZoneCircleView } from "@/components/admin/zone-map";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CsvImport, type CsvColumn } from "@/components/common/csv-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

type Pincode = {
  pincode: string;
  area: string;
  city: string | null;
  district: string | null;
  state: string | null;
  lat: number;
  lng: number;
};
type Zone = {
  id: string;
  name: string;
  code: string;
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: string | null;
};
type Area = {
  id: string;
  pincode: string;
  name: string;
  city: string | null;
  state: string | null;
  zoneId?: string;
  zone?: { name: string; code: string };
};
type Setting = { key: string; value: string };
const ANY = "__any__";
const AREA_CSV_COLUMNS: CsvColumn[] = [
  { key: "pincode", label: "Pincode", required: true, example: "560001" },
  { key: "zoneCode", label: "Zone code", required: true, example: "BLR-N" },
  { key: "name", label: "Name", example: "MG Road" },
];

export default function AreasPage() {
  const qc = useQueryClient();
  const [stateSel, setStateSel] = useState("");
  const [citySel, setCitySel] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Pincode | null>(null);
  const [newZone, setNewZone] = useState<{ name: string; code: string; radiusKm: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; zoneId: string } | null>(null);

  const { data: zonesData } = useQuery({
    queryKey: ["zones"],
    queryFn: () => api.get<{ data: Zone[] }>("/api/admin/zones"),
  });
  const { data: settingsData } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ data: Setting[] }>("/api/admin/settings"),
  });
  const { data: areasData, isLoading: areasLoading } = useQuery({
    queryKey: ["areas"],
    queryFn: () => api.get<{ data: Area[] }>("/api/admin/areas"),
  });
  const { data: statesData } = useQuery({
    queryKey: ["facets"],
    queryFn: () => api.get<{ data: { states: string[] } }>("/api/admin/pincodes/facets"),
  });
  const { data: citiesData } = useQuery({
    queryKey: ["facets", stateSel],
    queryFn: () =>
      api.get<{ data: { cities: string[] } }>(
        `/api/admin/pincodes/facets?state=${encodeURIComponent(stateSel)}`,
      ),
    enabled: !!stateSel,
  });
  const { data: searchData, isFetching } = useQuery({
    queryKey: ["pincode-search", q, stateSel, citySel],
    queryFn: () => {
      const p = new URLSearchParams({ q });
      if (stateSel) p.set("state", stateSel);
      if (citySel) p.set("city", citySel);
      return api.get<{ data: Pincode[] }>(`/api/admin/pincodes/search?${p}`);
    },
    enabled: q.trim().length >= 2,
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

  const containingZoneId = selected
    ? zoneForPoint({ lat: selected.lat, lng: selected.lng }, circles as ZoneCircle[])
    : null;
  const containingZone = zones.find((z) => z.id === containingZoneId);

  const addArea = useMutation({
    mutationFn: (zoneId: string) =>
      api.post("/api/admin/areas", {
        pincode: selected!.pincode,
        name: selected!.area,
        city: selected!.city,
        state: selected!.state,
        lat: selected!.lat,
        lng: selected!.lng,
        zoneId,
      }),
    onSuccess: () => {
      toast.success("Area added");
      qc.invalidateQueries({ queryKey: ["areas"] });
      setSelected(null);
      setQ("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createZoneAndArea = useMutation({
    mutationFn: async (form: { name: string; code: string; radiusKm: string }) => {
      const zone = await api.post<{ data: { id: string } }>("/api/admin/zones", {
        name: form.name,
        code: form.code,
        radiusKm: Number(form.radiusKm),
        centerLat: selected!.lat,
        centerLng: selected!.lng,
      });
      await api.post("/api/admin/areas", {
        pincode: selected!.pincode,
        name: selected!.area,
        city: selected!.city,
        state: selected!.state,
        lat: selected!.lat,
        lng: selected!.lng,
        zoneId: zone.data.id,
      });
    },
    onSuccess: () => {
      toast.success("Zone created and area added");
      qc.invalidateQueries({ queryKey: ["zones"] });
      qc.invalidateQueries({ queryKey: ["areas"] });
      setNewZone(null);
      setSelected(null);
      setQ("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/areas/${id}`),
    onSuccess: () => {
      toast.success("Area removed");
      qc.invalidateQueries({ queryKey: ["areas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editArea = useMutation({
    mutationFn: (v: { id: string; name: string; zoneId: string }) =>
      api.patch(`/api/admin/areas/${v.id}`, { name: v.name, zoneId: v.zoneId }),
    onSuccess: () => {
      toast.success("Area updated");
      qc.invalidateQueries({ queryKey: ["areas"] });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const results = searchData?.data ?? [];
  const areas = areasData?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Areas"
        description="Search a locality, then add its pincode to the zone that covers it — or create a new zone."
        actions={
          <CsvImport
            title="Import areas"
            columns={AREA_CSV_COLUMNS}
            endpoint="/api/admin/areas/bulk"
            templateFilename="areas-template.csv"
            onDone={() => qc.invalidateQueries({ queryKey: ["areas"] })}
          />
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        {/* Search + selection */}
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-sm font-medium">Add a serviceable area</p>
            <p className="text-xs text-muted-foreground">
              Search a locality or pincode, pick it, then add it to a zone (or create one).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={stateSel || ANY} onValueChange={(v) => { setStateSel(v === ANY ? "" : v); setCitySel(""); }}>
              <SelectTrigger><SelectValue placeholder="State (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any state</SelectItem>
                {(statesData?.data.states ?? []).map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={citySel || ANY} onValueChange={(v) => setCitySel(v === ANY ? "" : v)} disabled={!stateSel}>
              <SelectTrigger><SelectValue placeholder="City (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any city</SelectItem>
                {(citiesData?.data.cities ?? []).map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search area / locality / pincode…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {q.trim().length >= 2 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border">
              {isFetching && <p className="p-3 text-sm text-muted-foreground">Searching…</p>}
              {!isFetching && results.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">
                  No matches for “{q}”. Try a locality, city or pincode.
                </p>
              )}
              {results.map((r) => (
                <button
                  key={r.pincode}
                  type="button"
                  onClick={() => setSelected(r)}
                  className="flex w-full items-center justify-between gap-2 border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted"
                >
                  <span className="min-w-0 truncate">
                    {r.area}
                    <span className="text-muted-foreground"> · {[r.city, r.state].filter(Boolean).join(", ")}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{r.pincode}</span>
                </button>
              ))}
            </div>
          )}

          {selected && (
            <Card>
              <CardContent className="flex flex-col gap-3 p-4">
                <div>
                  <p className="text-sm font-medium">{selected.area}</p>
                  <p className="text-xs text-muted-foreground">
                    {[selected.city, selected.state].filter(Boolean).join(", ")} ·{" "}
                    <span className="font-mono">{selected.pincode}</span>
                  </p>
                </div>
                {containingZone ? (
                  <>
                    <p className="text-sm">
                      Falls inside{" "}
                      <Badge variant="secondary">{containingZone.name} ({containingZone.code})</Badge>
                    </p>
                    <Button disabled={addArea.isPending} onClick={() => addArea.mutate(containingZone.id)}>
                      Add to {containingZone.code}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      This location isn&apos;t inside any existing zone.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => setNewZone({ name: selected.city ?? selected.area, code: "", radiusKm: String(defaultRadius) })}
                    >
                      <MapPin className="size-4" /> Create a zone here
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Map */}
        <Card>
          <CardContent className="p-2">
            <ZoneMap
              zones={circles}
              markers={selected ? [{ lat: selected.lat, lng: selected.lng, label: `${selected.area} (${selected.pincode})` }] : []}
            />
          </CardContent>
        </Card>
      </div>

      {/* Existing areas */}
      <div>
        <h2 className="mb-2 text-sm font-medium">Serviceable areas</h2>
        {areasLoading ? (
          <Skeleton className="h-40 w-full rounded-lg" />
        ) : areas.length === 0 ? (
          <EmptyState title="No serviceable areas yet" description="Search above to add pincodes to zones." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pincode</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="hidden sm:table-cell">City / State</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {areas.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.pincode}</TableCell>
                    <TableCell className="text-sm">{a.name}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                      {[a.city, a.state].filter(Boolean).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm">{a.zone ? `${a.zone.code}` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Edit"
                          onClick={() => setEditing({ id: a.id, name: a.name, zoneId: a.zoneId ?? "" })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => { if (confirm(`Remove ${a.pincode}?`)) del.mutate(a.id); }}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Edit-area dialog (rename + reassign zone) */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit area</DialogTitle>
          </DialogHeader>
          {editing && (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                editArea.mutate(editing);
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Zone</Label>
                <Select
                  value={editing.zoneId}
                  onValueChange={(v) => setEditing({ ...editing, zoneId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name} ({z.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={editArea.isPending || !editing.zoneId}>
                  {editArea.isPending ? "Saving…" : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Create-zone dialog (no zone fits) */}
      <Dialog open={!!newZone} onOpenChange={(o) => !o && setNewZone(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New zone here</DialogTitle>
          </DialogHeader>
          {newZone && selected && (
            <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); createZoneAndArea.mutate(newZone); }}>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="nz-name">Name</Label>
                  <Input id="nz-name" required value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="nz-code">Code</Label>
                  <Input id="nz-code" required value={newZone.code} onChange={(e) => setNewZone({ ...newZone, code: e.target.value })} placeholder="ZONE-1" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nz-radius">Radius (km)</Label>
                <Input id="nz-radius" type="number" step="0.5" min="0.5" required value={newZone.radiusKm} onChange={(e) => setNewZone({ ...newZone, radiusKm: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                Centered at {selected.area} ({selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}). The area will be added to it.
              </p>
              <DialogFooter>
                <Button type="submit" disabled={createZoneAndArea.isPending}>
                  {createZoneAndArea.isPending ? "Creating…" : "Create zone & add area"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
