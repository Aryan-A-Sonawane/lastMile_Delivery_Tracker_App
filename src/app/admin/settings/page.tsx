"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/common/page-header";
import { Administrators } from "@/components/admin/administrators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Setting = { key: string; value: string; description: string | null };
type UpsertPayload = { key: string; value: string; description?: string | null };
type UpsertResponse = {
  data: Setting;
  swept?: { assigned: number; pending: number };
};

const AUTO_ASSIGN_KEY = "autoAssignEnabled";

function useUpsertSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertPayload) =>
      api.put<UpsertResponse>("/api/admin/settings", payload),
    onSuccess: () => {
      toast.success("Setting saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function AutoAssignCard({ setting }: { setting: Setting | undefined }) {
  const qc = useQueryClient();
  const enabled = (setting?.value ?? "false").trim().toLowerCase() === "true";

  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      api.put<UpsertResponse>("/api/admin/settings", {
        key: AUTO_ASSIGN_KEY,
        value: next ? "true" : "false",
        description:
          setting?.description ??
          "Auto-assign new orders to the best available agent (off = manual assignment)",
      }),
    onSuccess: (res, next) => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (next && res.swept) {
        toast.success(
          res.swept.assigned > 0
            ? `Auto-assign on — assigned ${res.swept.assigned} pending order${res.swept.assigned === 1 ? "" : "s"}` +
                (res.swept.pending > 0 ? `, ${res.swept.pending} still waiting for an agent` : "")
            : "Auto-assign on — no pending orders to assign",
        );
      } else {
        toast.success(next ? "Auto-assign on" : "Auto-assign off — assign orders manually");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="grid gap-1">
        <Label className="text-sm font-medium">Auto-assign new orders</Label>
        <p className="text-xs text-muted-foreground">
          When on, each new order is assigned to the best available agent
          (proximity, workload, zone, route direction and rating). Turning it on
          also sweeps any orders currently waiting for assignment. When off, you
          assign every order manually from the order page.
        </p>
      </div>
      <Switch
        checked={enabled}
        disabled={toggle.isPending}
        onCheckedChange={(v) => toggle.mutate(v)}
        aria-label="Toggle auto-assignment"
      />
    </div>
  );
}

function SettingRow({ setting }: { setting: Setting }) {
  const [value, setValue] = useState(setting.value);
  const upsert = useUpsertSetting();
  const dirty = value !== setting.value;

  return (
    <div className="flex items-end gap-3 rounded-lg border p-4">
      <div className="grid flex-1 gap-1">
        <Label className="font-mono text-xs">{setting.key}</Label>
        {setting.description && (
          <p className="text-xs text-muted-foreground">{setting.description}</p>
        )}
        <Input value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      <Button
        size="sm"
        disabled={!dirty || upsert.isPending}
        onClick={() =>
          upsert.mutate({ key: setting.key, value, description: setting.description })
        }
      >
        Save
      </Button>
    </div>
  );
}

function AddSettingDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ key: "", value: "", description: "" });
  const upsert = useUpsertSetting();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Add setting
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New setting</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            upsert.mutate(
              { key: form.key, value: form.value, description: form.description || null },
              {
                onSuccess: () => {
                  setOpen(false);
                  setForm({ key: "", value: "", description: "" });
                },
              },
            );
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              required
              value={form.key}
              onChange={(e) => setForm((s) => ({ ...s, key: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="value">Value</Label>
            <Input
              id="value"
              required
              value={form.value}
              onChange={(e) => setForm((s) => ({ ...s, value: e.target.value }))}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={form.description}
              onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={upsert.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<{ data: Setting[] }>("/api/admin/settings"),
  });
  const settings = data?.data ?? [];
  const autoAssign = settings.find((s) => s.key === AUTO_ASSIGN_KEY);
  const otherSettings = settings.filter((s) => s.key !== AUTO_ASSIGN_KEY);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Global configuration, and who can administer the platform."
      />

      <Administrators />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Assignment</h2>
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-lg" />
        ) : (
          <AutoAssignCard setting={autoAssign} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Configuration</h2>
          <AddSettingDialog />
        </div>
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        {!isLoading && otherSettings.length === 0 && (
          <p className="text-sm text-muted-foreground">No settings yet.</p>
        )}
        {otherSettings.map((s) => (
          <SettingRow key={s.key} setting={s} />
        ))}
      </section>
    </div>
  );
}
