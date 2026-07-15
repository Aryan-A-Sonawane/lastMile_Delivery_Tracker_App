import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?redirectTo=/app");
  if (profile.role !== "CUSTOMER") redirect("/");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/app" className="font-semibold">
            Last-Mile
          </Link>
          <div className="flex items-center gap-3">
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
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
