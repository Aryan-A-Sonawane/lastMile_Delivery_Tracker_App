"use client";

import { Check, User, Phone, Mail, AlertTriangle, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "./status-badge";

// The happy-path lifecycle shown as a stepper. Exception states (failed,
// rescheduled, returned) render as a banner above the steps.
const STEPS = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

type Party = {
  name: string;
  email?: string | null;
  phone?: string | null;
  note?: string | null;
};

function Contact({
  role,
  party,
}: {
  role: string;
  party: Party;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-lg border p-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <User className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{role}</p>
        <p className="truncate text-sm font-medium">{party.name}</p>
        {party.note && (
          <p className="truncate text-xs text-muted-foreground">{party.note}</p>
        )}
        <div className="mt-1 flex flex-col gap-0.5">
          {party.phone && (
            <a
              href={`tel:${party.phone}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Phone className="size-3" /> {party.phone}
            </a>
          )}
          {party.email && (
            <a
              href={`mailto:${party.email}`}
              className="flex items-center gap-1.5 truncate text-xs text-muted-foreground hover:text-foreground"
            >
              <Mail className="size-3 shrink-0" /> <span className="truncate">{party.email}</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrderStatusBar({
  status,
  agent,
  customer,
  showCustomer = false,
  scheduledDate,
}: {
  status: string;
  agent?: Party | null;
  customer?: Party | null;
  showCustomer?: boolean;
  scheduledDate?: string | null;
}) {
  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number]);
  // Where along the happy path an exception state sits, for the stepper fill.
  const exceptionIndex =
    status === "FAILED" || status === "RESCHEDULED"
      ? STEPS.indexOf("OUT_FOR_DELIVERY")
      : status === "RETURN_TO_SENDER"
        ? STEPS.length - 1
        : currentIndex;
  const activeIndex = currentIndex >= 0 ? currentIndex : exceptionIndex;

  const banner =
    status === "FAILED"
      ? { tone: "warn" as const, icon: AlertTriangle, text: "Last delivery attempt failed — a re-delivery can be booked." }
      : status === "RESCHEDULED"
        ? {
            tone: "warn" as const,
            icon: AlertTriangle,
            text: scheduledDate
              ? `Re-delivery booked for ${new Date(scheduledDate).toLocaleString()}.`
              : "Re-delivery booked — awaiting an agent.",
          }
        : status === "RETURN_TO_SENDER"
          ? { tone: "bad" as const, icon: Undo2, text: "All attempts used — the package is being returned to the sender." }
          : null;

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          Current status:{" "}
          <span className="font-semibold">{STATUS_LABELS[status] ?? status}</span>
        </p>
      </div>

      {banner && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
            banner.tone === "bad"
              ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
              : "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
          )}
        >
          <banner.icon className="size-4 shrink-0" />
          <span>{banner.text}</span>
        </div>
      )}

      {/* Stepper */}
      <ol className="flex items-center">
        {STEPS.map((step, i) => {
          const done = i < activeIndex || status === "DELIVERED";
          const active = i === activeIndex && status !== "DELIVERED";
          const isLast = i === STEPS.length - 1;
          return (
            <li key={step} className={cn("flex items-center", !isLast && "flex-1")}>
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary text-primary ring-2 ring-primary/30",
                    !done && !active && "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-center text-[10px] leading-tight sm:block",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {STATUS_LABELS[step]}
                </span>
              </div>
              {!isLast && (
                <span
                  className={cn(
                    "mx-1 h-0.5 flex-1 rounded",
                    i < activeIndex ? "bg-primary" : "bg-muted-foreground/20",
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Who's handling it + contacts */}
      <div className="grid gap-3 sm:grid-cols-2">
        {agent ? (
          <Contact role="Handled by (delivery agent)" party={agent} />
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <User className="size-4" /> No agent assigned yet
          </div>
        )}
        {showCustomer && customer && <Contact role="Customer" party={customer} />}
      </div>
    </div>
  );
}
