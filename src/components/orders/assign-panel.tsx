"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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

type Agent = {
  id: string;
  status: string;
  activeOrders: number;
  maxActiveOrders: number;
  homeZone?: { name: string; code: string } | null;
  profile: { name: string };
};

type ScoredReason = {
  reason?: string;
  score?: number;
  method?: string;
};

export function AssignPanel({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const [agentId, setAgentId] = useState("");
  const [lastReason, setLastReason] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["agents"],
    queryFn: () => api.get<{ data: Agent[] }>("/api/admin/agents"),
  });

  const assign = useMutation({
    mutationFn: (payload: { mode: "MANUAL" | "AUTO"; agentId?: string }) =>
      api.post<{ data: { agentId: string; method: string; reason: ScoredReason } }>(
        `/api/orders/${orderId}/assign`,
        payload,
      ),
    onSuccess: (res) => {
      const r = res.data.reason;
      setLastReason(
        res.data.method === "AUTO" && r?.reason
          ? `Auto: ${r.reason}${r.score != null ? ` (score ${r.score})` : ""}`
          : "Manually assigned",
      );
      toast.success("Agent assigned");
      qc.invalidateQueries({ queryKey: ["order", orderId] });
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const available = (data?.data ?? []).filter(
    (a) => a.status === "AVAILABLE" && a.activeOrders < a.maxActiveOrders,
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Assign agent</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Button
          onClick={() => assign.mutate({ mode: "AUTO" })}
          disabled={assign.isPending}
        >
          <Zap className="size-4" /> Auto-assign nearest available
        </Button>

        <div className="flex items-center gap-2">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Choose an agent" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No available agents
                </div>
              )}
              {available.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.profile.name} · {a.homeZone?.code ?? "—"} · {a.activeOrders}/
                  {a.maxActiveOrders}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            disabled={!agentId || assign.isPending}
            onClick={() => assign.mutate({ mode: "MANUAL", agentId })}
          >
            Assign
          </Button>
        </div>

        {lastReason && (
          <p className="text-xs text-muted-foreground">{lastReason}</p>
        )}
      </CardContent>
    </Card>
  );
}
