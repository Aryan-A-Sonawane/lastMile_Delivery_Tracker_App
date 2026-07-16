"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { OrdersTable, type OrderRow } from "@/components/orders/orders-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["orders", "customer"],
    queryFn: () => api.get<{ data: OrderRow[] }>("/api/orders?scope=customer"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">My orders</h1>
          <p className="text-sm text-muted-foreground">
            Track your shipments and place new orders.
          </p>
        </div>
        <Button asChild>
          <Link href="/app/orders/new">New order</Link>
        </Button>
      </div>

      {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
      {isError && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}
      {data && <OrdersTable orders={data.data} basePath="/app/orders" showAgent />}
    </div>
  );
}
