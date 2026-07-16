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
    <Link href="/admin" className="flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Truck className="size-4" />
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
    <div className="flex min-h-full flex-1 flex-col">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col gap-6 p-4">
                <Brand email={email} />
                {/* Close the drawer when a link is tapped */}
                <div onClick={() => setOpen(false)}>
                  <AdminNav />
                </div>
                <div onClick={() => setOpen(false)}>
                  <ViewSwitcher />
                </div>
                <div className="mt-auto border-t pt-4">
                  <LogoutButton />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">Admin</span>
        </div>
        <NotificationBell />
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:gap-8 lg:px-6 lg:py-8">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col lg:flex">
          <div className="mb-6 flex items-start justify-between gap-2">
            <Brand email={email} />
            <NotificationBell />
          </div>
          <AdminNav />
          <div className="mt-6 border-t pt-4">
            <LogoutButton />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-4 hidden justify-end lg:flex">
            <ViewSwitcher />
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
