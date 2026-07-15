import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { NotificationBell } from "@/components/notification-bell";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?redirectTo=/admin");
  if (profile.role !== "ADMIN") redirect("/");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-6 py-8">
      <aside className="w-52 shrink-0">
        <div className="mb-6 flex items-start justify-between">
          <Link href="/">
            <p className="text-sm font-semibold">Admin console</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile.email}
            </p>
          </Link>
          <NotificationBell />
        </div>
        <AdminNav />
        <div className="mt-6 border-t pt-4">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
