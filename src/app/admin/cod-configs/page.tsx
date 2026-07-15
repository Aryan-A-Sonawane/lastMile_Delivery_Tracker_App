"use client";

import {
  ResourceManager,
  type Column,
  type Field,
} from "@/components/admin/resource-manager";
import { Badge } from "@/components/ui/badge";

type CodConfig = {
  id: string;
  orderType: "B2B" | "B2C";
  mode: "FLAT" | "PERCENT";
  amount: string;
  isActive: boolean;
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
    name: "mode",
    label: "Mode",
    type: "select",
    required: true,
    options: [
      { value: "FLAT", label: "Flat amount" },
      { value: "PERCENT", label: "Percent of base charge" },
    ],
  },
  { name: "amount", label: "Amount", type: "number", step: "0.01", required: true, placeholder: "30" },
];

const columns: Column<CodConfig>[] = [
  { header: "Order type", render: (c) => c.orderType },
  { header: "Mode", render: (c) => (c.mode === "FLAT" ? "Flat" : "Percent") },
  {
    header: "Amount",
    render: (c) => (c.mode === "PERCENT" ? `${Number(c.amount)}%` : Number(c.amount).toFixed(2)),
  },
  {
    header: "Status",
    render: (c) =>
      c.isActive ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>,
  },
];

export default function CodConfigsPage() {
  return (
    <ResourceManager<CodConfig>
      title="COD Surcharge"
      description="Cash-on-delivery surcharge per order type (flat or percent of base charge)."
      endpoint="/api/admin/cod-configs"
      queryKey="cod-configs"
      fields={fields}
      columns={columns}
      addLabel="Add COD config"
      toPayload={(f) => ({
        orderType: f.orderType,
        mode: f.mode,
        amount: Number(f.amount),
      })}
    />
  );
}
