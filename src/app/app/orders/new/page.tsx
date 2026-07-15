"use client";

import { useRouter } from "next/navigation";
import { OrderForm } from "@/components/orders/order-form";

export default function NewOrderPage() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">New order</h1>
        <p className="text-sm text-muted-foreground">
          Enter shipment details, review the auto-calculated charge, then confirm.
        </p>
      </div>
      <OrderForm onCreated={(id) => router.push(`/app/orders/${id}`)} />
    </div>
  );
}
