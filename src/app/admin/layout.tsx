import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?redirectTo=/admin");
  if (!profile.roles.includes("ADMIN")) redirect("/");

  return <AdminShell email={profile.email}>{children}</AdminShell>;
}
