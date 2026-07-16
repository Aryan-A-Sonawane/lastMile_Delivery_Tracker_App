"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Truck } from "lucide-react";
import { AdminNav } from "./admin-nav";
import { ViewSwitcher } from "./view-switcher";
import { NotificationBell } from "@/components/notification-bell";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

function Brand({ email }: { email: string }) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand">
        <Truck className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">Last-Mile</span>
        <span className="block truncate text-xs text-muted-foreground">{email}</span>
      </span>
    </Link>
  );
}

export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar — pinned to the left edge, sticky, full height */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
        <div className="px-4 py-4">
          <Brand email={email} />
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <AdminNav />
        </div>
        <div className="border-t p-3">
          <LogoutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (all sizes) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-2.5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col gap-5 p-4">
                  <Brand email={email} />
                  <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
                    <AdminNav />
                  </div>
                  <div onClick={() => setOpen(false)}>
                    <ViewSwitcher />
                  </div>
                  <div className="border-t pt-4">
                    <LogoutButton />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-sm font-semibold lg:hidden">Admin</span>
            <span className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground lg:inline">
              Admin console
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block">
              <ViewSwitcher />
            </span>
            <NotificationBell />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
