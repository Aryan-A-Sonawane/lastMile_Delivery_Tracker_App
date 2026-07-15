"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { OrderForm } from "@/components/orders/order-form";
import { Skeleton } from "@/components/ui/skeleton";

type Customer = { id: string; name: string; email: string };

export default function AdminNewOrderPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: () => api.get<{ data: Customer[] }>("/api/admin/customers"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">New order (on behalf of a customer)</h1>
        <p className="text-sm text-muted-foreground">
          Select a customer, enter shipment details and confirm the charge.
        </p>
      </div>
      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <OrderForm
          customers={data?.data ?? []}
          onCreated={(id) => router.push(`/admin/orders/${id}`)}
        />
      )}
    </div>
  );
}
