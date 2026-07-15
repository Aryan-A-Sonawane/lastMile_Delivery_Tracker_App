"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ReschedulePanel({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  const mut = useMutation({
    mutationFn: () =>
      api.post<{ data: { reassigned: boolean; status: string } }>(
        `/api/orders/${orderId}/reschedule`,
        { requestedDate: date, reason: reason || undefined },
      ),
    onSuccess: (res) => {
      toast.success(
        res.data.reassigned
          ? "Rescheduled and reassigned to a new agent"
          : "Rescheduled — awaiting agent assignment",
      );
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="border-orange-300 dark:border-orange-900">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="size-4 text-orange-600" />
          Delivery failed — reschedule
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="reschedule-date">New delivery date</Label>
          <Input
            id="reschedule-date"
            type="date"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Textarea
          placeholder="Reason / instructions (optional)"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button disabled={!date || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? "Rescheduling…" : "Reschedule delivery"}
        </Button>
      </CardContent>
    </Card>
  );
}
