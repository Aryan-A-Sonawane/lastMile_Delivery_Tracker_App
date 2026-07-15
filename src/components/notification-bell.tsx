"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationItem = {
  id: string;
  payload: { message?: string; status?: string; trackingNumber?: string };
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell() {
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api.get<{ data: { items: NotificationItem[]; unread: number } }>(
        "/api/notifications",
      ),
    refetchInterval: 20_000,
  });

  const markRead = useMutation({
    mutationFn: () => api.post("/api/notifications/read", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = data?.data.items ?? [];
  const unread = data?.data.unread ?? 0;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && unread > 0) markRead.mutate();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              className={`border-b px-3 py-2.5 last:border-0 ${
                n.readAt ? "" : "bg-muted/40"
              }`}
            >
              <p className="text-sm">{n.payload.message ?? n.payload.status}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(n.createdAt)}
              </p>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
