"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { QuoteResult } from "@/lib/orders/pricing";

export function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1.5 text-sm ${
        strong ? "font-medium" : ""
      } ${muted ? "text-muted-foreground" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function QuoteBreakdown({ result }: { result: QuoteResult }) {
  const b = result.breakdown;
  const c = b.currency;

  const maxWeight = Math.max(b.actualWeightKg, b.volumetricWeightKg);
  const basis =
    b.billableWeightKg > maxWeight
      ? "minimum chargeable weight"
      : b.volumetricWeightKg >= b.actualWeightKg
        ? "volumetric weight"
        : "actual weight";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <p className="text-sm text-muted-foreground">Estimated charge</p>
          <p className="text-3xl font-semibold tabular-nums">{money(b.total, c)}</p>
        </div>
        <Badge variant={result.zoneType === "INTRA" ? "secondary" : "default"}>
          {result.zoneType === "INTRA" ? "Same zone" : "Cross zone"}
        </Badge>
      </CardHeader>
      <CardContent className="divide-y">
        <div className="pb-2">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Weight
          </p>
          <Row
            label={`Volumetric (L×B×H ÷ ${b.volumetricDivisor})`}
            value={`${b.volumetricWeightKg} kg`}
            muted={basis !== "volumetric weight"}
          />
          <Row
            label="Actual"
            value={`${b.actualWeightKg} kg`}
            muted={basis !== "actual weight"}
          />
          <Row
            label={<>Billable <span className="text-muted-foreground">({basis})</span></>}
            value={`${b.billableWeightKg} kg`}
            strong
          />
        </div>

        <div className="py-2">
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Charge
          </p>
          <Row label="Base rate" value={money(b.baseRate, c)} />
          <Row
            label={`Weight charge (${money(b.perKgRate, c)}/kg × ${b.billableWeightKg} kg)`}
            value={money(b.weightCharge, c)}
          />
          <Row label="Base charge" value={money(b.baseCharge, c)} strong />
          {b.codSurcharge > 0 && (
            <Row label="COD surcharge" value={money(b.codSurcharge, c)} />
          )}
        </div>

        <div className="pt-2">
          <Row label="Total" value={money(b.total, c)} strong />
        </div>
      </CardContent>
    </Card>
  );
}
