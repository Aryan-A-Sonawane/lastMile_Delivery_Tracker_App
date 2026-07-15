"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { QuoteResult } from "@/lib/orders/pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
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
import { QuoteBreakdown } from "@/components/quote/quote-breakdown";

type Form = {
  pickupPincode: string;
  dropPincode: string;
  lengthCm: string;
  breadthCm: string;
  heightCm: string;
  actualWeightKg: string;
  orderType: "B2C" | "B2B";
  paymentType: "PREPAID" | "COD";
};

const initial: Form = {
  pickupPincode: "560001",
  dropPincode: "560041",
  lengthCm: "40",
  breadthCm: "30",
  heightCm: "20",
  actualWeightKg: "3",
  orderType: "B2C",
  paymentType: "PREPAID",
};

export default function RateCalculatorPage() {
  const [form, setForm] = useState<Form>(initial);

  const quote = useMutation({
    mutationFn: () =>
      api.post<{ data: QuoteResult }>("/api/quote", {
        pickupPincode: form.pickupPincode,
        dropPincode: form.dropPincode,
        lengthCm: Number(form.lengthCm),
        breadthCm: Number(form.breadthCm),
        heightCm: Number(form.heightCm),
        actualWeightKg: Number(form.actualWeightKg),
        orderType: form.orderType,
        paymentType: form.paymentType,
      }),
  });

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((s) => ({ ...s, [key]: value }));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rate calculator</h1>
          <p className="text-sm text-muted-foreground">
            See exactly how a delivery charge is computed — zone, volumetric
            weight, rate card and COD surcharge.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/">← Home</Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipment details</CardTitle>
            <CardDescription>Enter package and route information.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                quote.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="pickupPincode">Pickup pincode</Label>
                  <Input
                    id="pickupPincode"
                    value={form.pickupPincode}
                    onChange={(e) => set("pickupPincode", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dropPincode">Drop pincode</Label>
                  <Input
                    id="dropPincode"
                    value={form.dropPincode}
                    onChange={(e) => set("dropPincode", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(["lengthCm", "breadthCm", "heightCm"] as const).map((k) => (
                  <div key={k} className="grid gap-1.5">
                    <Label htmlFor={k} className="capitalize">
                      {k.replace("Cm", "")} (cm)
                    </Label>
                    <Input
                      id={k}
                      type="number"
                      step="any"
                      value={form[k]}
                      onChange={(e) => set(k, e.target.value)}
                      required
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="actualWeightKg">Weight (kg)</Label>
                  <Input
                    id="actualWeightKg"
                    type="number"
                    step="any"
                    value={form.actualWeightKg}
                    onChange={(e) => set("actualWeightKg", e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Order type</Label>
                  <Select
                    value={form.orderType}
                    onValueChange={(v) => set("orderType", v as Form["orderType"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2C">B2C</SelectItem>
                      <SelectItem value="B2B">B2B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Payment</Label>
                  <Select
                    value={form.paymentType}
                    onValueChange={(v) => set("paymentType", v as Form["paymentType"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PREPAID">Prepaid</SelectItem>
                      <SelectItem value="COD">COD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button type="submit" disabled={quote.isPending}>
                {quote.isPending ? "Calculating…" : "Calculate charge"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3">
          {quote.isError && (
            <Card className="border-destructive/50">
              <CardContent className="py-4 text-sm text-destructive">
                {(quote.error as Error).message}
              </CardContent>
            </Card>
          )}
          {quote.data ? (
            <QuoteBreakdown result={quote.data.data} />
          ) : (
            !quote.isError && (
              <Card className="border-dashed">
                <CardContent className="flex h-full items-center justify-center py-12 text-center text-sm text-muted-foreground">
                  Enter details and calculate to see a full charge breakdown.
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </main>
  );
}
