"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { allowedNextStatuses } from "@/lib/domain/status-machine";
import type { OrderStatus, ActorRole } from "@/lib/domain/types";
import { STATUS_LABELS } from "./status-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FAILURE_REASONS: [string, string][] = [
  ["CUSTOMER_UNAVAILABLE", "Customer unavailable"],
  ["WRONG_ADDRESS", "Wrong address"],
  ["REFUSED", "Refused"],
  ["DAMAGED", "Damaged"],
  ["OTHER", "Other"],
];

export function StatusUpdatePanel({
  orderId,
  currentStatus,
  actorRole,
}: {
  orderId: string;
  currentStatus: string;
  actorRole: "AGENT" | "ADMIN";
}) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("OTHER");

  const next = allowedNextStatuses(
    currentStatus as OrderStatus,
    actorRole as ActorRole,
  );

  // Agents must leave a remark explaining a failed delivery attempt.
  const remarkRequiredForFailed = actorRole === "AGENT";

  const mut = useMutation({
    mutationFn: (status: string) =>
      api.post(`/api/orders/${orderId}/status`, {
        status,
        note: note || undefined,
        reason: status === "FAILED" ? reason : undefined,
      }),
    onSuccess: () => {
      toast.success("Status updated");
      setNote("");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (status: string) => {
    if (status === "FAILED" && remarkRequiredForFailed && !note.trim()) {
      toast.error("Add a remark explaining why the delivery failed.");
      return;
    }
    mut.mutate(status);
  };

  if (next.length === 0) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          This order is complete — no further updates.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {actorRole === "ADMIN" ? "Override status" : "Update status"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {next.includes("FAILED") && (
          <div className="grid gap-1.5">
            <Label>Failure reason (if failed)</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FAILURE_REASONS.map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Textarea
          placeholder={
            next.includes("FAILED") && remarkRequiredForFailed
              ? "Remark — required if the delivery failed"
              : "Note (optional)"
          }
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {next.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={
                s === "FAILED"
                  ? "destructive"
                  : s === "DELIVERED"
                    ? "default"
                    : "secondary"
              }
              disabled={mut.isPending}
              onClick={() => update(s)}
            >
              {STATUS_LABELS[s] ?? s}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
