"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type Agent = {
  id: string;
  status: "AVAILABLE" | "BUSY" | "OFFLINE";
  activeOrders: number;
  maxActiveOrders: number;
  currentLat: number | null;
  currentLng: number | null;
  profile: { name: string; email: string; phone: string | null };
  homeZone?: { name: string; code: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  BUSY: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  OFFLINE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export default function AdminAgentsPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<{ data: Agent[] }>("/api/admin/agents"),
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Agents</h1>
        <p className="text-sm text-muted-foreground">
          Delivery agents, their availability and current load.
        </p>
      </div>

      {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
      {isError && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}
      {data && (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Home zone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Load</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="font-medium">{a.profile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.profile.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {a.homeZone ? `${a.homeZone.name} (${a.homeZone.code})` : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_STYLE[a.status],
                      )}
                    >
                      {a.status}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {a.activeOrders}/{a.maxActiveOrders}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.currentLat != null && a.currentLng != null
                      ? `${a.currentLat.toFixed(3)}, ${a.currentLng.toFixed(3)}`
                      : "—"}
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
