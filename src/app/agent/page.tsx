"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { OrdersTable, type OrderRow } from "@/components/orders/orders-table";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentDashboard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["orders", "agent"],
    queryFn: () => api.get<{ data: OrderRow[] }>("/api/orders?scope=agent"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">My deliveries</h1>
        <p className="text-sm text-muted-foreground">
          Orders assigned to you. Status updates arrive in the next phase.
        </p>
      </div>

      {isLoading && <Skeleton className="h-40 w-full rounded-lg" />}
      {isError && (
        <p className="text-sm text-destructive">{(error as Error).message}</p>
      )}
      {data && (
        <OrdersTable orders={data.data} basePath="/agent/orders" showCustomer />
      )}
    </div>
  );
}
