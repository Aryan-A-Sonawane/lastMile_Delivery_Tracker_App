import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Configure the pricing engine and zone detection. Everything here is
          admin-configurable — nothing is hardcoded.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const card = (
            <Card
              className={
                s.href ? "h-full transition-colors hover:border-primary/50" : "h-full"
              }
            >
              <CardHeader className="pb-2">
                <CardDescription>{s.label}</CardDescription>
                <CardTitle className="text-3xl">{s.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          );
          return s.href ? (
            <Link key={s.label} href={s.href}>
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
