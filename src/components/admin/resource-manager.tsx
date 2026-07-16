"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

export type FieldType = "text" | "number" | "select";

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  step?: string;
  options?: { value: string; label: string }[];
  defaultValue?: string;
};

export type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

type Props<T extends { id: string }> = {
  title: string;
  description: string;
  endpoint: string; // e.g. "/api/admin/zones"
  queryKey: string;
  columns: Column<T>[];
  fields: Field[];
  /** Convert the raw string form values into the JSON payload for the API. */
  toPayload: (form: Record<string, string>) => unknown;
  addLabel?: string;
  /** When set, renders an "Active" switch column bound to this boolean field. */
  toggle?: { key: string; header?: string };
};

function initialForm(fields: Field[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""]));
}

export function ResourceManager<T extends { id: string }>({
  title,
  description,
  endpoint,
  queryKey,
  columns,
  fields,
  toPayload,
  addLabel = "Add",
  toggle,
}: Props<T>) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => initialForm(fields));

  const { data, isLoading, isError, error } = useQuery({
    queryKey: [queryKey],
    queryFn: () => api.get<{ data: T[] }>(endpoint),
  });

  const createMut = useMutation({
    mutationFn: () => api.post(endpoint, toPayload(form)),
    onSuccess: () => {
      toast.success(`${title} created`);
      qc.invalidateQueries({ queryKey: [queryKey] });
      setForm(initialForm(fields));
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`${endpoint}/${id}`),
    onSuccess: () => {
      toast.success(`${title} deleted`);
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) =>
      api.patch(`${endpoint}/${id}`, { [toggle!.key]: value }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data?.data ?? [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> {addLabel}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New {title.replace(/s$/, "").toLowerCase()}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMut.mutate();
              }}
            >
              {fields.map((f) => (
                <div key={f.name} className="grid gap-1.5">
                  <Label htmlFor={f.name}>{f.label}</Label>
                  {f.type === "select" ? (
                    <Select
                      value={form[f.name]}
                      onValueChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))}
                    >
                      <SelectTrigger id={f.name}>
                        <SelectValue placeholder={f.placeholder ?? "Select…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {(f.options ?? []).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={f.name}
                      type={f.type === "number" ? "number" : "text"}
                      step={f.step}
                      placeholder={f.placeholder}
                      required={f.required}
                      value={form[f.name]}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [f.name]: e.target.value }))
                      }
                    />
                  )}
                </div>
              ))}
              <DialogFooter>
                <Button type="submit" disabled={createMut.isPending}>
                  {createMut.isPending ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.header} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
              {toggle && <TableHead>{toggle.header ?? "Active"}</TableHead>}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length + 1 + (toggle ? 1 : 0)}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {isError && (
              <TableRow>
                <TableCell colSpan={columns.length + 1 + (toggle ? 1 : 0)} className="text-destructive">
                  {(error as Error)?.message ?? "Failed to load"}
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1 + (toggle ? 1 : 0)}
                  className="text-center text-muted-foreground"
                >
                  No {title.toLowerCase()} yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((c) => (
                  <TableCell key={c.header} className={c.className}>
                    {c.render(row)}
                  </TableCell>
                ))}
                {toggle && (
                  <TableCell>
                    <Switch
                      checked={Boolean((row as Record<string, unknown>)[toggle.key])}
                      onCheckedChange={(v) => toggleMut.mutate({ id: row.id, value: v })}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (confirm("Delete this record?")) deleteMut.mutate(row.id);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
