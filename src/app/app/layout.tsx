import { redirect } from "next/navigation";
import Link from "next/link";
import { Truck } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ViewSwitcher } from "@/components/admin/view-switcher";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?redirectTo=/app");
  if (!profile.roles.includes("CUSTOMER") && !profile.roles.includes("ADMIN"))
    redirect("/");

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/app" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-brand">
              <Truck className="size-4" />
            </span>
            <span className="font-semibold">Last-Mile</span>
          </Link>
          <div className="flex items-center gap-3">
            {profile.roles.includes("ADMIN") && (
              <span className="hidden sm:block">
                <ViewSwitcher />
              </span>
            )}
            <Button asChild size="sm">
              <Link href="/app/orders/new">New order</Link>
            </Button>
            <NotificationBell />
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {profile.name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
