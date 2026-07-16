import { redirect } from "next/navigation";
import Link from "next/link";
import { Bike } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/session";
import { LogoutButton } from "@/components/auth/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ViewSwitcher } from "@/components/admin/view-switcher";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?redirectTo=/agent");
  if (!profile.roles.includes("AGENT") && !profile.roles.includes("ADMIN"))
    redirect("/");

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href="/agent" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-brand-gradient text-white shadow-brand">
                <Bike className="size-4" />
              </span>
              <span className="font-semibold">Agent · Last-Mile</span>
            </Link>
            <Link
              href="/agent/profile"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Serving location
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {profile.roles.includes("ADMIN") && (
              <span className="hidden sm:block">
                <ViewSwitcher />
              </span>
            )}
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
