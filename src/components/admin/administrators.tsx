"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, X } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Admin = { id: string; name: string; email: string };

export function Administrators() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: () =>
      api.get<{ data: { admins: Admin[]; currentId: string } }>("/api/admin/admins"),
  });

  const invite = useMutation({
    mutationFn: () =>
      api.post<{ data: { created: boolean; tempPassword: string | null } }>(
        "/api/admin/admins",
        form,
      ),
    onSuccess: (res) => {
      toast.success(
        res.data.created && res.data.tempPassword
          ? `Admin created — temp password: ${res.data.tempPassword}`
          : "Admin access granted",
        { duration: 8000 },
      );
      qc.invalidateQueries({ queryKey: ["admins"] });
      setOpen(false);
      setForm({ email: "", name: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/admins/${id}`),
    onSuccess: () => {
      toast.success("Admin access revoked");
      qc.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const admins = data?.data.admins ?? [];
  const currentId = data?.data.currentId;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">Administrators</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="size-4" /> Invite admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite an administrator</DialogTitle>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="ad-name">Name</Label>
                <Input id="ad-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ad-email">Email</Label>
                <Input id="ad-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">
                They&apos;ll get an email to sign in. Existing users are promoted to admin.
              </p>
              <DialogFooter>
                <Button type="submit" disabled={invite.isPending}>
                  {invite.isPending ? "Inviting…" : "Send invite"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && <Skeleton className="h-16 w-full rounded-lg" />}
        {admins.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {a.name}
                {a.id === currentId && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{a.email}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Revoke admin"
              disabled={a.id === currentId || admins.length <= 1 || remove.isPending}
              onClick={() => {
                if (confirm(`Revoke admin access for ${a.email}?`)) remove.mutate(a.id);
              }}
            >
              <X className="size-4 text-destructive" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
