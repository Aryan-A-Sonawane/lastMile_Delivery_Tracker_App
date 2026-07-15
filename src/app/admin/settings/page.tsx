"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function useUpsertSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertPayload) => api.put("/api/admin/settings", payload),
    onSuccess: () => {
      toast.success("Setting saved");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
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

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Global configuration such as the volumetric divisor and currency.
          </p>
        </div>
        <AddSettingDialog />
      </div>

      <div className="flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        {!isLoading && settings.length === 0 && (
          <p className="text-sm text-muted-foreground">No settings yet.</p>
        )}
        {settings.map((s) => (
          <SettingRow key={s.key} setting={s} />
        ))}
      </div>
    </section>
  );
}
