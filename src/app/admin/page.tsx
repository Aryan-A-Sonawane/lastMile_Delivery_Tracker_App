import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const [zones, areas, rateCards, codConfigs, agents, orders] = await Promise.all([
    prisma.zone.count(),
    prisma.area.count(),
    prisma.rateCard.count({ where: { isActive: true } }),
    prisma.codConfig.count({ where: { isActive: true } }),
    prisma.agentProfile.count(),
    prisma.order.count(),
  ]);

  const stats: {
    label: string;
    value: number;
    href?: string;
    hint: string;
  }[] = [
    { label: "Zones", value: zones, href: "/admin/zones", hint: "Delivery zones" },
    { label: "Areas", value: areas, href: "/admin/areas", hint: "Pincode → zone mappings" },
    { label: "Active rate cards", value: rateCards, href: "/admin/rate-cards", hint: "B2B/B2C × intra/inter" },
    { label: "Active COD configs", value: codConfigs, href: "/admin/cod-configs", hint: "Surcharge per order type" },
    { label: "Agents", value: agents, href: "/admin/agents", hint: "Delivery agents" },
    { label: "Orders", value: orders, href: "/admin/orders", hint: "All orders" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Configure the pricing engine and zone detection — everything here is admin-configurable, nothing is hardcoded."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            hint={s.hint}
            href={s.href}
          />
        ))}
      </div>
    </div>
  );
}
