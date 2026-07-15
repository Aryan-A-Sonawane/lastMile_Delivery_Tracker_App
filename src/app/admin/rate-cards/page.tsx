"use client";

import {
  ResourceManager,
  type Column,
  type Field,
} from "@/components/admin/resource-manager";
import { Badge } from "@/components/ui/badge";

type RateCard = {
  id: string;
  orderType: "B2B" | "B2C";
  scope: "INTRA" | "INTER";
  baseRate: string;
  perKgRate: string;
  minChargeableWeight: string;
  isActive: boolean;
  effectiveFrom: string;
};

const fields: Field[] = [
  {
    name: "orderType",
    label: "Order type",
    type: "select",
    required: true,
    options: [
      { value: "B2C", label: "B2C" },
      { value: "B2B", label: "B2B" },
    ],
  },
  {
    name: "scope",
    label: "Scope",
    type: "select",
    required: true,
    options: [
      { value: "INTRA", label: "Intra-zone" },
      { value: "INTER", label: "Inter-zone" },
    ],
  },
  { name: "baseRate", label: "Base rate", type: "number", step: "0.01", required: true, placeholder: "40" },
  { name: "perKgRate", label: "Per-kg rate", type: "number", step: "0.01", required: true, placeholder: "15" },
  {
    name: "minChargeableWeight",
    label: "Min chargeable weight (kg)",
    type: "number",
    step: "0.001",
    defaultValue: "0.5",
  },
];

const columns: Column<RateCard>[] = [
  { header: "Order type", render: (r) => r.orderType },
  { header: "Scope", render: (r) => (r.scope === "INTRA" ? "Intra-zone" : "Inter-zone") },
  { header: "Base", render: (r) => Number(r.baseRate).toFixed(2) },
  { header: "Per kg", render: (r) => Number(r.perKgRate).toFixed(2) },
  { header: "Min kg", render: (r) => Number(r.minChargeableWeight).toFixed(3) },
  {
    header: "Status",
    render: (r) =>
      r.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
  },
];

export default function RateCardsPage() {
  return (
    <ResourceManager<RateCard>
      title="Rate Cards"
      description="Zone rates per order type. charge = baseRate + perKgRate × billableWeight."
      endpoint="/api/admin/rate-cards"
      queryKey="rate-cards"
      fields={fields}
      columns={columns}
      addLabel="Add rate card"
      toPayload={(f) => ({
        orderType: f.orderType,
        scope: f.scope,
        baseRate: Number(f.baseRate),
        perKgRate: Number(f.perKgRate),
        minChargeableWeight:
          f.minChargeableWeight.trim() === "" ? 0.5 : Number(f.minChargeableWeight),
      })}
    />
  );
}
