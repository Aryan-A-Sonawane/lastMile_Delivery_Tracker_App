"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { OrdersTable, type OrderRow } from "@/components/orders/orders-table";
import { STATUS_LABELS } from "@/components/orders/status-badge";
import { PageHeader } from "@/components/common/page-header";
import { CsvImport, type CsvColumn } from "@/components/common/csv-import";
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

const ORDER_CSV_COLUMNS: CsvColumn[] = [
  { key: "customerEmail", label: "Customer email", required: true, example: "customer1@lastmile.test" },
  { key: "pickupPincode", label: "Pickup pincode", required: true, example: "560001" },
  { key: "dropPincode", label: "Drop pincode", required: true, example: "560041" },
  { key: "pickupAddress", label: "Pickup address", required: true, example: "1 MG Road" },
  { key: "dropAddress", label: "Drop address", required: true, example: "9 South Ave" },
  { key: "lengthCm", label: "Length (cm)", required: true, example: "40" },
  { key: "breadthCm", label: "Breadth (cm)", required: true, example: "30" },
  { key: "heightCm", label: "Height (cm)", required: true, example: "20" },
  { key: "actualWeightKg", label: "Weight (kg)", required: true, example: "3" },
  { key: "orderType", label: "Order type", required: true, example: "B2C" },
  { key: "paymentType", label: "Payment type", required: true, example: "PREPAID" },
];

function OrdersContent() {
  const sp = useSearchParams();
  const qc = useQueryClient();
  const [status, setStatus] = useState(sp.get("status") ?? ALL);
  const [zoneId, setZoneId] = useState(sp.get("zoneId") ?? ALL);

  const { data: zones } = useQuery({
    queryKey: ["zones"],
    queryFn: () => api.get<{ data: Zone[] }>("/api/admin/zones"),
  });

  const qs = new URLSearchParams({ scope: "admin" });
  if (status !== ALL) qs.set("status", status);
  if (zoneId !== ALL) qs.set("zoneId", zoneId);
  const query = qs.toString();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["orders", "admin", query],
    queryFn: () => api.get<{ data: OrderRow[] }>(`/api/orders${query ? `?${query}` : ""}`),
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Orders"
        description="All orders across customers, agents and zones."
        actions={
          <>
            <CsvImport
              title="Import orders"
              columns={ORDER_CSV_COLUMNS}
              endpoint="/api/admin/orders/bulk"
              templateFilename="orders-template.csv"
              onDone={() => qc.invalidateQueries({ queryKey: ["orders"] })}
            />
            <Button asChild size="sm">
              <Link href="/admin/orders/new">New order</Link>
            </Button>
          </>
        }
      />

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
      {isError && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data && <OrdersTable orders={data.data} basePath="/admin/orders" showCustomer showAgent />}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-lg" />}>
      <OrdersContent />
    </Suspense>
  );
}
