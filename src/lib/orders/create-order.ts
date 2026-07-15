import { Prisma, type Order } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ActorRole } from "@/lib/domain/types";
import type { OrderCreateInput } from "@/lib/validation/order";
import { loadQuoteConfig } from "./pricing-data";
import { resolveQuote } from "./pricing";
import { generateTrackingNumber } from "./tracking";

type CreateOrderArgs = {
  input: OrderCreateInput;
  customerId: string; // the customer the order is for
  createdById: string; // who created it (customer or admin)
  createdByRole: ActorRole;
};

/**
 * Creates an order: recomputes the charge server-side (never trusting a client
 * price), snapshots the full breakdown, allocates a unique tracking number, and
 * writes the initial CREATED status-history row — all in one transaction.
 */
export async function createOrder({
  input,
  customerId,
  createdById,
  createdByRole,
}: CreateOrderArgs): Promise<Order> {
  const config = await loadQuoteConfig();
  const { pickupZoneId, dropZoneId, breakdown } = resolveQuote(config, {
    pickupPincode: input.pickupPincode,
    dropPincode: input.dropPincode,
    lengthCm: input.lengthCm,
    breadthCm: input.breadthCm,
    heightCm: input.heightCm,
    actualWeightKg: input.actualWeightKg,
    orderType: input.orderType,
    paymentType: input.paymentType,
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    const trackingNumber = generateTrackingNumber();
    try {
      return await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            trackingNumber,
            customerId,
            createdById,
            pickupAddress: input.pickupAddress,
            pickupPincode: input.pickupPincode,
            pickupZoneId,
            pickupLat: input.pickupLat ?? null,
            pickupLng: input.pickupLng ?? null,
            dropAddress: input.dropAddress,
            dropPincode: input.dropPincode,
            dropZoneId,
            dropLat: input.dropLat ?? null,
            dropLng: input.dropLng ?? null,
            lengthCm: input.lengthCm,
            breadthCm: input.breadthCm,
            heightCm: input.heightCm,
            actualWeightKg: input.actualWeightKg,
            volumetricWeightKg: breakdown.volumetricWeightKg,
            billableWeightKg: breakdown.billableWeightKg,
            orderType: input.orderType,
            paymentType: input.paymentType,
            chargeBreakdown: breakdown as unknown as Prisma.InputJsonValue,
            totalCharge: breakdown.total,
            currency: breakdown.currency,
            status: "CREATED",
            scheduledDate: input.scheduledDate ?? null,
          },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: "CREATED",
            actorId: createdById,
            actorRole: createdByRole,
            note: "Order created",
          },
        });

        return order;
      });
    } catch (e) {
      // Retry once or twice on a tracking-number collision.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        attempt < 2
      ) {
        continue;
      }
      throw e;
    }
  }

  throw new Error("Failed to allocate a unique tracking number");
}
