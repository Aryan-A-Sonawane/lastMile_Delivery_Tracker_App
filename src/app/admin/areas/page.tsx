"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import {
  ResourceManager,
  type Column,
  type Field,
} from "@/components/admin/resource-manager";

type Zone = { id: string; code: string; name: string };
type Area = {
  id: string;
  name: string;
  pincode: string;
  zone?: { id: string; name: string; code: string };
};

const columns: Column<Area>[] = [
  { header: "Pincode", render: (a) => <span className="font-mono">{a.pincode}</span> },
  { header: "Area", render: (a) => a.name },
  { header: "Zone", render: (a) => (a.zone ? `${a.zone.name} (${a.zone.code})` : "—") },
];

export default function AreasPage() {
  const { data } = useQuery({
    queryKey: ["zones"],
    queryFn: () => api.get<{ data: Zone[] }>("/api/admin/zones"),
  });

  const zoneOptions = (data?.data ?? []).map((z) => ({
    value: z.id,
    label: `${z.name} (${z.code})`,
  }));

  const fields: Field[] = [
    { name: "pincode", label: "Pincode", type: "text", required: true, placeholder: "560001" },
    { name: "name", label: "Area name", type: "text", required: true, placeholder: "MG Road" },
    { name: "zoneId", label: "Zone", type: "select", required: true, options: zoneOptions },
  ];

  return (
    <ResourceManager<Area>
      title="Areas"
      description="Map each pincode to exactly one zone — this drives zone detection."
      endpoint="/api/admin/areas"
      queryKey="areas"
      fields={fields}
      columns={columns}
      addLabel="Add area"
      toPayload={(f) => ({ pincode: f.pincode, name: f.name, zoneId: f.zoneId })}
    />
  );
}
