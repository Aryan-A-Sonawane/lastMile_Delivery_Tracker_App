import type { Order } from "@prisma/client";
import { getAppUrl } from "@/lib/config/app-url";

const STATUS_HEADLINE: Record<string, string> = {
  CREATED: "Your order has been placed",
  ASSIGNED: "A delivery agent has been assigned",
  PICKED_UP: "Your package has been picked up",
  IN_TRANSIT: "Your package is in transit",
  OUT_FOR_DELIVERY: "Your package is out for delivery",
  DELIVERED: "Your package has been delivered",
  FAILED: "Delivery attempt failed",
  RESCHEDULED: "Your delivery has been rescheduled",
  RETURN_TO_SENDER: "Your package is being returned to the sender",
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
  RETURN_TO_SENDER: "Returned to sender",
};

export type BuiltMessage = {
  subject: string;
  html: string;
  text: string;
  sms: string;
  inApp: string;
};

// Brand-aligned status colours (hex — email clients don't grok oklch).
const STATUS_COLOR: Record<string, string> = {
  CREATED: "#64748b",
  ASSIGNED: "#2563eb",
  PICKED_UP: "#4f46e5",
  IN_TRANSIT: "#7c3aed",
  OUT_FOR_DELIVERY: "#d97706",
  DELIVERED: "#16a34a",
  FAILED: "#dc2626",
  RESCHEDULED: "#ea580c",
  RETURN_TO_SENDER: "#e11d48",
};

// The happy-path stages, rendered as a compact progress row in the email.
const STAGES = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export function buildStatusMessage(
  order: Pick<Order, "id" | "trackingNumber" | "status" | "scheduledDate">,
): BuiltMessage {
  const tn = order.trackingNumber;
  const status = order.status;
  const headline = STATUS_HEADLINE[status] ?? `Status: ${status}`;
  const label = STATUS_LABEL[status] ?? status;
  const color = STATUS_COLOR[status] ?? "#4f46e5";
  const base = getAppUrl();
  const trackUrl = `${base}/track/${encodeURIComponent(tn)}`;
  // Authenticated order page (where the customer can reschedule / manage). If
  // they're signed out, the app routes them through login first, then here.
  const manageUrl = `${base}/app/orders/${order.id}`;
  const failed = status === "FAILED";
  // Primary CTA: manage/reschedule for a failed delivery, else public tracking.
  const ctaUrl = failed ? manageUrl : trackUrl;
  const ctaLabel = failed ? "Book re-delivery →" : "Track your shipment →";

  const extra =
    status === "FAILED"
      ? " You can request re-delivery (a date within the next 3 days) from your orders page."
      : status === "RESCHEDULED" && order.scheduledDate
        ? ` New date: ${order.scheduledDate.toISOString().slice(0, 10)}.`
        : status === "RETURN_TO_SENDER"
          ? " All delivery attempts were used, so the package is on its way back to the sender."
          : "";

  const inApp = `${headline} (${tn}).${extra}`;
  const sms = `${headline} for ${tn}.${extra} ${failed ? "Re-book" : "Track"}: ${ctaUrl}`;
  const subject = `Order ${tn}: ${label}`;
  const text = `${headline}\n\nTracking number: ${tn}${extra}\n\n${
    failed ? `Book re-delivery: ${manageUrl}\nTrack: ${trackUrl}` : `Track your shipment: ${trackUrl}`
  }`;

  const activeIndex = STAGES.indexOf(status as (typeof STAGES)[number]);
  const progress = STAGES.map((s, i) => {
    const done = activeIndex >= 0 && i <= activeIndex;
    const dot = done ? color : "#e2e8f0";
    const line =
      i < STAGES.length - 1
        ? `<td width="100%" style="padding:0 2px"><div style="height:3px;border-radius:3px;background:${
            activeIndex >= 0 && i < activeIndex ? color : "#e2e8f0"
          }"></div></td>`
        : "";
    return `<td style="width:14px"><div style="width:12px;height:12px;border-radius:50%;background:${dot}"></div></td>${line}`;
  }).join("");

  const html = `
  <div style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:'Segoe UI',system-ui,-apple-system,Arial,sans-serif">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px -12px rgba(79,70,229,.35)">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 55%,#2563eb 100%);padding:22px 28px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
          <tr>
            <td style="vertical-align:middle">
              <span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;background:rgba(255,255,255,.18);border-radius:10px;font-size:18px">🚚</span>
            </td>
            <td style="vertical-align:middle;padding-left:10px;color:#fff;font-weight:600;font-size:15px">Last-Mile Delivery</td>
          </tr>
        </table>
      </div>

      <!-- Body -->
      <div style="padding:28px">
        <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${color}1a;color:${color};font-size:12px;font-weight:700;letter-spacing:.02em;text-transform:uppercase">${label}</span>
        <h1 style="margin:14px 0 6px;font-size:20px;line-height:1.3;color:#0f172a">${headline}</h1>
        <p style="margin:0 0 18px;color:#475569;font-size:14px;line-height:1.6">
          Tracking number
          <span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-weight:600;color:#0f172a;background:#f1f5f9;padding:2px 8px;border-radius:6px">${tn}</span>${extra ? `<br/>${extra}` : ""}
        </p>

        <!-- Progress -->
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 22px">
          <tr>${progress}</tr>
        </table>

        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600">${ctaLabel}</a>
        ${failed ? `<div style="margin-top:12px"><a href="${trackUrl}" style="color:#64748b;font-size:13px;text-decoration:underline">Or just track your shipment</a></div>` : ""}
      </div>

      <!-- Footer -->
      <div style="padding:16px 28px;border-top:1px solid #eef2f7;background:#fafbff">
        <p style="margin:0;color:#94a3b8;font-size:12px">Last-Mile Delivery Tracker · transparent pricing · live tracking</p>
      </div>
    </div>
  </div>`;

  return { subject, html, text, sms, inApp };
}
