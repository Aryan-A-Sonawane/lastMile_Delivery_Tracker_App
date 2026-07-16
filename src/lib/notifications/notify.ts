import { Prisma, type NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildStatusMessage } from "./templates";
import { sendEmail, isEmailConfigured } from "./email";
import { sendSms, isSmsConfigured } from "./sms";

const CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "SMS"];

/**
 * Notifies the order's customer of the order's current status across channels.
 * Idempotent: a unique `idempotencyKey` per (order, status, attempt, channel)
 * means retries never send duplicates. Never throws — notification failures are
 * recorded on the row and must not break the status-change request.
 */
export async function notifyOrderStatus(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    });
    if (!order) return;

    const msg = buildStatusMessage(order);

    for (const channel of CHANNELS) {
      const idempotencyKey = `${order.id}:${order.status}:${order.attemptNumber}:${channel}`;

      let notificationId: string;
      try {
        const created = await prisma.notification.create({
          data: {
            userId: order.customerId,
            orderId: order.id,
            channel,
            type: "STATUS_CHANGE",
            payload: {
              status: order.status,
              message: msg.inApp,
              trackingNumber: order.trackingNumber,
            },
            status: "PENDING",
            idempotencyKey,
          },
        });
        notificationId = created.id;
      } catch (e) {
        // Already sent for this (order, status, attempt, channel) — skip.
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === "P2002"
        ) {
          continue;
        }
        throw e;
      }

      try {
        if (channel === "EMAIL") {
          if (!isEmailConfigured()) throw new Error("SMTP not configured");
          const res = await sendEmail({
            to: order.customer.email,
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
          });
          await prisma.notification.update({
            where: { id: notificationId },
            data: { status: "SENT", sentAt: new Date(), providerMessageId: res.messageId },
          });
        } else if (channel === "SMS") {
          // Real SMS via Twilio when configured, else a mock logger.
          if (isSmsConfigured() && order.customer.phone) {
            const res = await sendSms(order.customer.phone, msg.sms);
            await prisma.notification.update({
              where: { id: notificationId },
              data: { status: "SENT", sentAt: new Date(), providerMessageId: res.id },
            });
          } else {
            console.log(`[SMS mock] to ${order.customer.phone ?? "n/a"}: ${msg.sms}`);
            await prisma.notification.update({
              where: { id: notificationId },
              data: { status: "SENT", sentAt: new Date(), providerMessageId: "mock" },
            });
          }
        } else {
          // IN_APP — the row itself is the delivery.
          await prisma.notification.update({
            where: { id: notificationId },
            data: { status: "SENT", sentAt: new Date() },
          });
        }
      } catch (err) {
        await prisma.notification.update({
          where: { id: notificationId },
          data: { status: "FAILED", error: String(err).slice(0, 300) },
        });
      }
    }
  } catch (e) {
    console.error("notifyOrderStatus failed:", e);
  }
}
