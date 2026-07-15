"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import type { QuoteResult } from "@/lib/orders/pricing";
import { QuoteBreakdown } from "@/components/quote/quote-breakdown";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Customer = { id: string; name: string; email: string };

type FormState = {
  customerId: string;
  pickupAddress: string;
  pickupPincode: string;
  dropAddress: string;
  dropPincode: string;
  lengthCm: string;
  breadthCm: string;
  heightCm: string;
  actualWeightKg: string;
  orderType: "B2C" | "B2B";
  paymentType: "PREPAID" | "COD";
};

const empty: FormState = {
  customerId: "",
  pickupAddress: "",
  pickupPincode: "",
  dropAddress: "",
  dropPincode: "",
  lengthCm: "",
  breadthCm: "",
  heightCm: "",
  actualWeightKg: "",
  orderType: "B2C",
  paymentType: "PREPAID",
};

function toQuoteBody(f: FormState) {
  return {
    pickupPincode: f.pickupPincode,
    dropPincode: f.dropPincode,
    lengthCm: Number(f.lengthCm),
    breadthCm: Number(f.breadthCm),
    heightCm: Number(f.heightCm),
    actualWeightKg: Number(f.actualWeightKg),
    orderType: f.orderType,
    paymentType: f.paymentType,
  };
}

export function OrderForm({
  customers,
  onCreated,
}: {
  customers?: Customer[];
  onCreated: (orderId: string) => void;
}) {
  const isAdmin = Array.isArray(customers);
  const [form, setForm] = useState<FormState>(empty);
  const [quote, setQuote] = useState<QuoteResult | null>(null);

  // Editing any field invalidates a stale quote — the customer must re-see the
  // price before confirming.
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((s) => ({ ...s, [k]: v }));
    setQuote(null);
  };

  const quoteMut = useMutation({
    mutationFn: () => api.post<{ data: QuoteResult }>("/api/quote", toQuoteBody(form)),
    onSuccess: (res) => setQuote(res.data),
    onError: (e: Error) => toast.error(e.message),
  });

  const createMut = useMutation({
    mutationFn: () =>
      api.post<{ data: { id: string } }>("/api/orders", {
        ...toQuoteBody(form),
        pickupAddress: form.pickupAddress,
        dropAddress: form.dropAddress,
        ...(isAdmin && form.customerId ? { customerId: form.customerId } : {}),
      }),
    onSuccess: (res) => {
      toast.success("Order created");
      onCreated(res.data.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canQuote =
    form.pickupPincode && form.dropPincode && form.lengthCm && form.breadthCm && form.heightCm && form.actualWeightKg;
  const canCreate =
    quote && form.pickupAddress && form.dropAddress && (!isAdmin || form.customerId);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Order details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              quoteMut.mutate();
            }}
          >
            {isAdmin && (
              <div className="grid gap-1.5">
                <Label>Customer</Label>
                <Select value={form.customerId} onValueChange={(v) => set("customerId", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers!.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pickupAddress">Pickup address</Label>
                <Textarea
                  id="pickupAddress"
                  rows={2}
                  value={form.pickupAddress}
                  onChange={(e) => set("pickupAddress", e.target.value)}
                />
                <Input
                  aria-label="Pickup pincode"
                  placeholder="Pickup pincode"
                  value={form.pickupPincode}
                  onChange={(e) => set("pickupPincode", e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dropAddress">Drop address</Label>
                <Textarea
                  id="dropAddress"
                  rows={2}
                  value={form.dropAddress}
                  onChange={(e) => set("dropAddress", e.target.value)}
                />
                <Input
                  aria-label="Drop pincode"
                  placeholder="Drop pincode"
                  value={form.dropPincode}
                  onChange={(e) => set("dropPincode", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  ["lengthCm", "L (cm)"],
                  ["breadthCm", "B (cm)"],
                  ["heightCm", "H (cm)"],
                  ["actualWeightKg", "Weight (kg)"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="grid gap-1.5">
                  <Label htmlFor={k}>{label}</Label>
                  <Input
                    id={k}
                    type="number"
                    step="any"
                    value={form[k]}
                    onChange={(e) => set(k, e.target.value)}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Order type</Label>
                <Select value={form.orderType} onValueChange={(v) => set("orderType", v as FormState["orderType"])}>
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
                <Select value={form.paymentType} onValueChange={(v) => set("paymentType", v as FormState["paymentType"])}>
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

            <Button type="submit" variant="secondary" disabled={!canQuote || quoteMut.isPending}>
              {quoteMut.isPending ? "Calculating…" : "Get quote"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {quote ? (
          <>
            <QuoteBreakdown result={quote} />
            <Button disabled={!canCreate || createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? "Creating…" : "Confirm & create order"}
            </Button>
            {!form.pickupAddress || !form.dropAddress ? (
              <p className="text-xs text-muted-foreground">
                Add pickup and drop addresses to confirm.
              </p>
            ) : null}
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex h-full items-center justify-center py-12 text-center text-sm text-muted-foreground">
              Fill in the details and get a quote to see the charge before
              confirming.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
