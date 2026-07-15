"use client";

import {
  ResourceManager,
  type Column,
  type Field,
} from "@/components/admin/resource-manager";

type Zone = {
  id: string;
  code: string;
  name: string;
  centerLat: number | null;
  centerLng: number | null;
  _count?: { areas: number };
};

const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

const fields: Field[] = [
  { name: "code", label: "Code", type: "text", required: true, placeholder: "BLR-N" },
  { name: "name", label: "Name", type: "text", required: true, placeholder: "North Bengaluru" },
  { name: "centerLat", label: "Center latitude", type: "number", step: "any", placeholder: "13.05" },
  { name: "centerLng", label: "Center longitude", type: "number", step: "any", placeholder: "77.59" },
];

const columns: Column<Zone>[] = [
  { header: "Code", render: (z) => <span className="font-mono">{z.code}</span> },
  { header: "Name", render: (z) => z.name },
  { header: "Areas", render: (z) => z._count?.areas ?? 0 },
  {
    header: "Center",
    render: (z) =>
      z.centerLat != null && z.centerLng != null
        ? `${z.centerLat}, ${z.centerLng}`
        : "—",
  },
];

export default function ZonesPage() {
  return (
    <ResourceManager<Zone>
      title="Zones"
      description="Delivery zones. Assign pincodes to zones under Areas."
      endpoint="/api/admin/zones"
      queryKey="zones"
      fields={fields}
      columns={columns}
      addLabel="Add zone"
      toPayload={(f) => ({
        code: f.code,
        name: f.name,
        centerLat: num(f.centerLat),
        centerLng: num(f.centerLng),
      })}
    />
  );
}
