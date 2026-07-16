"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/admin", label: "Admin" },
  { href: "/agent", label: "Agent" },
  { href: "/app", label: "Customer" },
];

/**
 * Admin-only view switcher — jump between the admin, agent and customer areas to
 * preview how changes look for each role. (The proxy lets admins access all.)
 */
export function ViewSwitcher() {
  const pathname = usePathname();
  const active = pathname.startsWith("/agent")
    ? "/agent"
    : pathname.startsWith("/app")
      ? "/app"
      : "/admin";

  return (
    <div className="flex items-center gap-0.5 rounded-lg border p-0.5 text-xs">
      <span className="px-1.5 text-[10px] font-medium uppercase text-muted-foreground">
        View
      </span>
      {VIEWS.map((v) => (
        <Link
          key={v.href}
          href={v.href}
          className={cn(
            "rounded-md px-2 py-1 font-medium transition-colors",
            active === v.href
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}
