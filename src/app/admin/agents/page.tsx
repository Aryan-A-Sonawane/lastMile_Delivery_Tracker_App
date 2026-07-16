"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { CsvImport, type CsvColumn } from "@/components/common/csv-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  profile: { name: string; email: string; phone: string | null };
  homeZone?: { name: string; code: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  BUSY: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  OFFLINE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const NONE = "__none__";
const csvColumns: CsvColumn[] = [
  { key: "name", label: "Name", required: true, example: "Ravi Kumar" },
  { key: "email", label: "Email", required: true, example: "ravi@example.com" },
  { key: "phone", label: "Phone", example: "+91 9000000000" },
  { key: "homeZoneCode", label: "Home zone code", example: "BLR-N" },
  { key: "maxActiveOrders", label: "Max active orders", example: "5" },
];

export default function AdminAgentsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    homeZoneId: "",
    maxActiveOrders: "5",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<{ data: Agent[] }>("/api/admin/agents"),
  });
  const { data: zonesData } = useQuery({
    queryKey: ["zones"],
    queryFn: () => api.get<{ data: Zone[] }>("/api/admin/zones"),
  });

  const create = useMutation({
    mutationFn: () =>
      api.post<{ data: { tempPassword?: string } }>("/api/admin/agents", {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        homeZoneId: form.homeZoneId || undefined,
        maxActiveOrders: Number(form.maxActiveOrders) || 5,
      }),
    onSuccess: (res) => {
      toast.success(
        res.data.tempPassword
          ? `Agent created — temp password: ${res.data.tempPassword}`
          : "Agent created",
        { duration: 8000 },
      );
      qc.invalidateQueries({ queryKey: ["agents"] });
      setOpen(false);
      setForm({ name: "", email: "", phone: "", homeZoneId: "", maxActiveOrders: "5" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/agents/${id}`),
    onSuccess: () => {
      toast.success("Agent deleted");
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agents = data?.data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Agents"
        description="Delivery agents — availability, load, and onboarding."
        actions={
          <>
            <CsvImport
              title="Import agents"
              columns={csvColumns}
              endpoint="/api/admin/agents/bulk"
              templateFilename="agents-template.csv"
              onDone={() => qc.invalidateQueries({ queryKey: ["agents"] })}
            />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="size-4" /> Add agent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New agent</DialogTitle>
                </DialogHeader>
                <form
                  className="grid gap-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    create.mutate();
                  }}
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="a-name">Name</Label>
                    <Input id="a-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="a-email">Email</Label>
                    <Input id="a-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="a-phone">Phone</Label>
                      <Input id="a-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="a-max">Max active orders</Label>
                      <Input id="a-max" type="number" min="1" value={form.maxActiveOrders} onChange={(e) => setForm({ ...form, maxActiveOrders: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Home zone</Label>
                    <Select value={form.homeZoneId || NONE} onValueChange={(v) => setForm({ ...form, homeZoneId: v === NONE ? "" : v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {(zonesData?.data ?? []).map((z) => (
                          <SelectItem key={z.id} value={z.id}>
                            {z.name} ({z.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A temporary password is generated and emailed to the agent.
                  </p>
                  <DialogFooter>
                    <Button type="submit" disabled={create.isPending}>
                      {create.isPending ? "Creating…" : "Create agent"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
      {!isLoading && agents.length === 0 && (
        <EmptyState title="No agents yet" description="Add an agent or import a CSV to onboard several at once." />
      )}
      {agents.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead className="hidden sm:table-cell">Home zone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Load</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => (
                <TableRow
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/agents/${a.id}`)}
                >
                  <TableCell>
                    <div className="font-medium">{a.profile.name}</div>
                    <div className="text-xs text-muted-foreground">{a.profile.email}</div>
                  </TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">
                    {a.homeZone ? `${a.homeZone.code}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[a.status])}>
                      {a.status}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {a.activeOrders}/{a.maxActiveOrders}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete agent ${a.profile.name}?`)) del.mutate(a.id);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
