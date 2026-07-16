"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { OrdersTable, type OrderRow } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Zone = { id: string; name: string; code: string };
type Agent = {
  id: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
  activeOrders: number;
  maxActiveOrders: number;
  currentLat: number | null;
  currentLng: number | null;
  profile: { name: string; email: string; phone: string | null };
  homeZone?: { id: string; name: string; code: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  BUSY: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  OFFLINE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
const NONE = "__none__";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<null | {
    name: string;
    phone: string;
    status: Agent["status"];
    homeZoneId: string;
    maxActiveOrders: string;
  }>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["agent", id],
    queryFn: () => api.get<{ data: Agent }>(`/api/admin/agents/${id}`),
  });
  const { data: ordersData } = useQuery({
    queryKey: ["orders", "agent", id],
    queryFn: () => api.get<{ data: OrderRow[] }>(`/api/orders?agentId=${id}`),
  });
  const { data: zonesData } = useQuery({
    queryKey: ["zones"],
    queryFn: () => api.get<{ data: Zone[] }>("/api/admin/zones"),
  });

  const update = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/agents/${id}`, {
        name: form!.name,
        phone: form!.phone || null,
        status: form!.status,
        homeZoneId: form!.homeZoneId || null,
        maxActiveOrders: Number(form!.maxActiveOrders) || 5,
      }),
    onSuccess: () => {
      toast.success("Agent updated");
      qc.invalidateQueries({ queryKey: ["agent", id] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full rounded-lg" />;
  const a = data.data;

  function startEdit() {
    setForm({
      name: a.profile.name,
      phone: a.profile.phone ?? "",
      status: a.status,
      homeZoneId: a.homeZone?.id ?? "",
      maxActiveOrders: String(a.maxActiveOrders),
    });
    setEditing(true);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={a.profile.name}
        description={a.profile.email}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/agents">← Agents</Link>
            </Button>
            <Dialog open={editing} onOpenChange={(o) => (o ? startEdit() : setEditing(false))}>
              <DialogTrigger asChild>
                <Button size="sm">Edit</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit agent</DialogTitle>
                </DialogHeader>
                {form && (
                  <form
                    className="grid gap-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      update.mutate();
                    }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="e-name">Name</Label>
                        <Input id="e-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="e-phone">Phone</Label>
                        <Input id="e-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label>Status</Label>
                        <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Agent["status"] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AVAILABLE">Available</SelectItem>
                            <SelectItem value="BUSY">Busy</SelectItem>
                            <SelectItem value="OFFLINE">Offline</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="e-max">Max active orders</Label>
                        <Input id="e-max" type="number" min="1" value={form.maxActiveOrders} onChange={(e) => setForm({ ...form, maxActiveOrders: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Home zone</Label>
                      <Select value={form.homeZoneId || NONE} onValueChange={(v) => setForm({ ...form, homeZoneId: v === NONE ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>None</SelectItem>
                          {(zonesData?.data ?? []).map((z) => (
                            <SelectItem key={z.id} value={z.id}>{z.name} ({z.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={update.isPending}>
                        {update.isPending ? "Saving…" : "Save"}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <Info
            label="Status"
            value={
              <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[a.status])}>
                {a.status}
              </span>
            }
          />
          <Info label="Load" value={`${a.activeOrders} / ${a.maxActiveOrders}`} />
          <Info label="Home zone" value={a.homeZone ? `${a.homeZone.name} (${a.homeZone.code})` : "—"} />
          <Info label="Phone" value={a.profile.phone ?? "—"} />
          <Info
            label="Location"
            value={a.currentLat != null && a.currentLng != null ? `${a.currentLat.toFixed(3)}, ${a.currentLng.toFixed(3)}` : "—"}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium">Orders</h2>
        <OrdersTable orders={ordersData?.data ?? []} basePath="/admin/orders" showCustomer />
      </div>
    </div>
  );
}
