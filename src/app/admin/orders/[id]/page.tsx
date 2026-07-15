"use client";

import { use } from "react";
import { OrderDetail } from "@/components/orders/order-detail";

export default function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <OrderDetail
      orderId={id}
      backHref="/admin/orders"
      showCustomer
      canAssign
      canReschedule
      statusActorRole="ADMIN"
    />
  );
}
