import type { Order } from "@prisma/client";

const STATUS_HEADLINE: Record<string, string> = {
  CREATED: "Your order has been placed",
  ASSIGNED: "A delivery agent has been assigned",
  PICKED_UP: "Your package has been picked up",
  IN_TRANSIT: "Your package is in transit",
  OUT_FOR_DELIVERY: "Your package is out for delivery",
  DELIVERED: "Your package has been delivered",
  FAILED: "Delivery attempt failed",
  RESCHEDULED: "Your delivery has been rescheduled",
};

const STATUS_LABEL: Record<string, string> = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "In transit",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  RESCHEDULED: "Rescheduled",
};

export type BuiltMessage = {
  subject: string;
  html: string;
  text: string;
  sms: string;
  inApp: string;
};

export function buildStatusMessage(
  order: Pick<Order, "trackingNumber" | "status" | "scheduledDate">,
): BuiltMessage {
  const tn = order.trackingNumber;
  const status = order.status;
  const headline = STATUS_HEADLINE[status] ?? `Status: ${status}`;
  const label = STATUS_LABEL[status] ?? status;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const trackUrl = `${base}/track/${encodeURIComponent(tn)}`;

  const extra =
    status === "FAILED"
      ? " You can reschedule from your orders page."
      : status === "RESCHEDULED" && order.scheduledDate
        ? ` New date: ${order.scheduledDate.toISOString().slice(0, 10)}.`
        : "";

  const inApp = `${headline} (${tn}).${extra}`;
  const sms = `${headline} for ${tn}.${extra} Track: ${trackUrl}`;
  const subject = `Order ${tn}: ${label}`;
  const text = `${headline}\n\nTracking number: ${tn}${extra}\n\nTrack your shipment: ${trackUrl}`;
  const html = `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 8px;font-size:18px">${headline}</h2>
    <p style="margin:0 0 16px;color:#475569">Tracking number <strong style="font-family:monospace">${tn}</strong>. Current status: <strong>${label}</strong>.${extra}</p>
    <a href="${trackUrl}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Track your shipment</a>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Last-Mile Delivery Tracker</p>
  </div>`;

  return { subject, html, text, sms, inApp };
}
