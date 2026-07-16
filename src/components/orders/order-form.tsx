"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, AlertTriangle, MapPin } from "lucide-react";
import { api } from "@/lib/api-client";
import type { QuoteResult } from "@/lib/orders/pricing";
import { QuoteBreakdown } from "@/components/quote/quote-breakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const LocationPickerMap = dynamic(
  () => import("@/components/agent/location-picker-map"),
  { ssr: false, loading: () => <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" /> },
);
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

type PincodeInfo = {
  pincode: string;
  area: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  serviceable: boolean;
};

type FormState = {
  customerId: string;
  pickupAddress: string;
  pickupPincode: string;
  pickupArea: string;
  dropAddress: string;
  dropPincode: string;
  dropArea: string;
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
  pickupArea: "",
  dropAddress: "",
  dropPincode: "",
  dropArea: "",
  lengthCm: "",
  breadthCm: "",
  heightCm: "",
  actualWeightKg: "",
  orderType: "B2C",
  paymentType: "PREPAID",
};

function usePincodeLookup(pincode: string) {
  const value = pincode.trim();
  return useQuery({
    queryKey: ["pincode-lookup", value],
    queryFn: () =>
      api.get<{ data: PincodeInfo | null }>(
        `/api/pincodes/lookup?pincode=${encodeURIComponent(value)}`,
      ),
    enabled: /^\d{4,10}$/.test(value),
    staleTime: 5 * 60_000,
  });
}

/** Pincode input + auto-resolved (editable) area field, with location feedback. */
function LocationFields({
  prefix,
  pincode,
  area,
  info,
  fetching,
  onPincode,
  onArea,
}: {
  prefix: string;
  pincode: string;
  area: string;
  info: PincodeInfo | null;
  fetching: boolean;
  onPincode: (v: string) => void;
  onArea: (v: string) => void;
}) {
  // Show the typed area, or fall back to the pincode's resolved locality.
  const resolvedArea = area || info?.area || "";
  const showHint = /^\d{4,10}$/.test(pincode.trim()) && !fetching;
  const place = [info?.city, info?.state].filter(Boolean).join(", ");

  return (
    <>
      <Input
        aria-label={`${prefix} pincode`}
        placeholder={`${prefix} pincode`}
        inputMode="numeric"
        value={pincode}
        onChange={(e) => onPincode(e.target.value)}
      />
      <Input
        aria-label={`${prefix} area / locality`}
        placeholder={`${prefix} area / locality`}
        value={resolvedArea}
        onChange={(e) => onArea(e.target.value)}
      />
      {showHint &&
        (info ? (
          <p
            className={`flex items-start gap-1 text-xs ${
              info.serviceable
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {info.serviceable ? (
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span>
              {info.area}
              {place ? `, ${place}` : ""}
              {info.serviceable ? "" : " · not currently serviceable"}
            </span>
          </p>
        ) : (
          <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <span>Pincode not recognised — please double-check it.</span>
          </p>
        ))}
    </>
  );
}

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

type NearestInfo = {
  pincode: string;
  area: string | null;
  city: string | null;
  state: string | null;
  distanceKm: number;
  serviceable: boolean;
};

/** Click a point on the map → reverse-geocode to the nearest known pincode. */
function MapPickerDialog({
  open,
  title,
  onClose,
  onApply,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onApply: (r: NearestInfo) => void;
}) {
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [info, setInfo] = useState<NearestInfo | null>(null);
  const [loading, setLoading] = useState(false);

  const pick = async (lat: number, lng: number) => {
    setPoint({ lat, lng });
    setLoading(true);
    setInfo(null);
    try {
      const res = await api.get<{ data: NearestInfo | null }>(
        `/api/pincodes/nearest?lat=${lat}&lng=${lng}`,
      );
      setInfo(res.data);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPoint(null);
          setInfo(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-hidden rounded-lg border">
          <LocationPickerMap value={point} onPick={pick} />
        </div>
        <div className="flex min-h-9 items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Finding nearest location…"
              : info
                ? `${info.area ?? "Unknown"}${info.city ? `, ${info.city}` : ""} · ${info.pincode}${info.serviceable ? "" : " · not serviceable"}`
                : "Click anywhere on the map to drop a pin."}
          </p>
          <Button
            disabled={!info}
            onClick={() => {
              if (info) onApply(info);
            }}
          >
            Use this location
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const [mapFor, setMapFor] = useState<null | "pickup" | "drop">(null);

  const pickupLookup = usePincodeLookup(form.pickupPincode);
  const dropLookup = usePincodeLookup(form.dropPincode);
  const pickupInfo = pickupLookup.data?.data ?? null;
  const dropInfo = dropLookup.data?.data ?? null;

  // Editing any pricing-relevant field invalidates a stale quote — the customer
  // must re-see the price before confirming.
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((s) => ({ ...s, [k]: v }));
    setQuote(null);
  };
  // Area only enriches the address; it doesn't change the price, so keep the quote.
  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  // Merge the confirmed area/locality into the stored address when it adds info.
  const composeAddress = (address: string, area: string, info: PincodeInfo | null) => {
    const loc = (area || info?.area || "").trim();
    const base = address.trim();
    if (!loc || base.toLowerCase().includes(loc.toLowerCase())) return base;
    return `${base}, ${loc}`;
  };

  // Apply a map-picked location: set pincode + area, and prefill the address.
  const applyPicked = (which: "pickup" | "drop", r: NearestInfo) => {
    const loc = [r.area, r.city, r.state].filter(Boolean).join(", ");
    setForm((s) => ({
      ...s,
      [`${which}Pincode`]: r.pincode,
      [`${which}Area`]: r.area ?? "",
      [`${which}Address`]: s[`${which}Address`].trim() || loc,
    }));
    setQuote(null); // pincode changed → re-quote
    setMapFor(null);
    if (!r.serviceable) toast.warning(`${r.pincode} isn't a serviceable area yet.`);
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
        pickupAddress: composeAddress(form.pickupAddress, form.pickupArea, pickupInfo),
        dropAddress: composeAddress(form.dropAddress, form.dropArea, dropInfo),
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="pickupAddress">Pickup address</Label>
                  <button
                    type="button"
                    onClick={() => setMapFor("pickup")}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <MapPin className="size-3.5" /> Pick on map
                  </button>
                </div>
                <Textarea
                  id="pickupAddress"
                  rows={2}
                  value={form.pickupAddress}
                  onChange={(e) => set("pickupAddress", e.target.value)}
                />
                <LocationFields
                  prefix="Pickup"
                  pincode={form.pickupPincode}
                  area={form.pickupArea}
                  info={pickupInfo}
                  fetching={pickupLookup.isFetching}
                  onPincode={(v) => set("pickupPincode", v)}
                  onArea={(v) => setField("pickupArea", v)}
                />
              </div>
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dropAddress">Drop address</Label>
                  <button
                    type="button"
                    onClick={() => setMapFor("drop")}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <MapPin className="size-3.5" /> Pick on map
                  </button>
                </div>
                <Textarea
                  id="dropAddress"
                  rows={2}
                  value={form.dropAddress}
                  onChange={(e) => set("dropAddress", e.target.value)}
                />
                <LocationFields
                  prefix="Drop"
                  pincode={form.dropPincode}
                  area={form.dropArea}
                  info={dropInfo}
                  fetching={dropLookup.isFetching}
                  onPincode={(v) => set("dropPincode", v)}
                  onArea={(v) => setField("dropArea", v)}
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

      <MapPickerDialog
        open={mapFor !== null}
        title={mapFor === "drop" ? "Pick the drop location" : "Pick the pickup location"}
        onClose={() => setMapFor(null)}
        onApply={(r) => mapFor && applyPicked(mapFor, r)}
      />
    </div>
  );
}
