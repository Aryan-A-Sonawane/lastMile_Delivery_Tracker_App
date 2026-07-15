"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { OrdersTable, type OrderRow } from "@/components/orders/orders-table";
import { STATUS_LABELS } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Zone = { id: string; name: string; code: string };
const ALL = "ALL";

export default function AdminOrdersPage() {
  const [status, setStatus] = useState(ALL);
  const [zoneId, setZoneId] = useState(ALL);

  const { data: zones } = useQuery({
    queryKey: ["zones"],
    queryFn: () => api.get<{ data: Zone[] }>("/api/admin/zones"),
  });

  const qs = new URLSearchParams();
  if (status !== ALL) qs.set("status", status);
  if (zoneId !== ALL) qs.set("zoneId", zoneId);
  const query = qs.toString();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["orders", "admin", query],
    queryFn: () => api.get<{ data: OrderRow[] }>(`/api/orders${query ? `?${query}` : ""}`),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Orders</h1>
          <p className="text-sm text-muted-foreground">
            All orders across customers, agents and zones.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/orders/new">New order</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={zoneId} onValueChange={setZoneId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Zone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All zones</SelectItem>
            {(zones?.data ?? []).map((z) => (
              <SelectItem key={z.id} value={z.id}>
                {z.name} ({z.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
      {isError && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}
      {data && (
        <OrdersTable
          orders={data.data}
          basePath="/admin/orders"
          showCustomer
          showAgent
        />
      )}
    </div>
  );
}
