"use client";

import { use } from "react";
import { OrderDetail } from "@/components/orders/order-detail";

export default function AgentOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <OrderDetail
      orderId={id}
      backHref="/agent"
      showCustomer
      statusActorRole="AGENT"
    />
  );
}
