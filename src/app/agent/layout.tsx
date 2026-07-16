import { redirect } from "next/navigation";
import Link from "next/link";
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
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-3">
          <Link href="/agent" className="font-semibold">
            Agent · Last-Mile
          </Link>
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
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">{children}</div>
    </div>
  );
}
