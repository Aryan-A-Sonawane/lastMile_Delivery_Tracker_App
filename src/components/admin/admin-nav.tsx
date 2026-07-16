"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Flame,
  Package,
  Users,
  Map,
  MapPin,
  ReceiptIndianRupee,
  Wallet,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/heatmap", label: "Heatmap", icon: Flame },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/agents", label: "Agents", icon: Users },
  { href: "/admin/zones", label: "Zones", icon: Map },
  { href: "/admin/areas", label: "Areas", icon: MapPin },
  { href: "/admin/rate-cards", label: "Rate Cards", icon: ReceiptIndianRupee },
  { href: "/admin/cod-configs", label: "COD Surcharge", icon: Wallet },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active =
          n.href === "/admin" ? pathname === "/admin" : pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-70")} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
