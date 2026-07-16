"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock } from "lucide-react";
import { api } from "@/lib/api-client";
import {
  MAX_DELIVERY_ATTEMPTS,
  RESCHEDULE_WINDOW_DAYS,
} from "@/lib/orders/attempts";
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

/** Format a Date as the value a datetime-local input expects (local time). */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ReschedulePanel({
  orderId,
  attemptNumber,
}: {
  orderId: string;
  attemptNumber: number;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const now = new Date();
  const max = new Date(now.getTime() + RESCHEDULE_WINDOW_DAYS * 86_400_000);
  const attemptsUsed = attemptNumber;
  const attemptsLeft = Math.max(0, MAX_DELIVERY_ATTEMPTS - attemptsUsed);

  const mut = useMutation({
    mutationFn: () =>
      api.post<{ data: { reassigned: boolean; status: string } }>(
        `/api/orders/${orderId}/reschedule`,
        { requestedDate: new Date(date).toISOString(), reason: reason || undefined },
      ),
    onSuccess: (res) => {
      toast.success(
        res.data.reassigned
          ? "Re-delivery booked and an agent is assigned"
          : "Re-delivery booked — awaiting agent assignment",
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
          Delivery failed — book re-delivery
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-xs text-muted-foreground">
          Attempt {attemptsUsed} of {MAX_DELIVERY_ATTEMPTS} used.{" "}
          {attemptsLeft > 0
            ? `${attemptsLeft} ${attemptsLeft === 1 ? "attempt" : "attempts"} left.`
            : "No attempts left."}{" "}
          Choose a slot within the next {RESCHEDULE_WINDOW_DAYS} days.
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor="reschedule-date">New delivery date &amp; time</Label>
          <Input
            id="reschedule-date"
            type="datetime-local"
            min={toLocalInput(now)}
            max={toLocalInput(max)}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <Textarea
          placeholder="Instructions for the agent (optional)"
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button disabled={!date || mut.isPending} onClick={() => mut.mutate()}>
          {mut.isPending ? "Booking…" : "Book re-delivery"}
        </Button>
      </CardContent>
    </Card>
  );
}
