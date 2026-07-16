import { z } from "zod";

export const quoteRequestSchema = z.object({
  pickupPincode: z.string().trim().regex(/^\d{4,10}$/, "invalid pincode"),
  dropPincode: z.string().trim().regex(/^\d{4,10}$/, "invalid pincode"),
  lengthCm: z.coerce.number().positive().max(1000),
  breadthCm: z.coerce.number().positive().max(1000),
  heightCm: z.coerce.number().positive().max(1000),
  actualWeightKg: z.coerce.number().positive().max(100000),
  orderType: z.enum(["B2B", "B2C"]),
  paymentType: z.enum(["PREPAID", "COD"]),
});

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

export const orderCreateSchema = quoteRequestSchema.extend({
  pickupAddress: z.string().trim().min(1, "pickup address is required").max(300),
  dropAddress: z.string().trim().min(1, "drop address is required").max(300),
  pickupLat: z.coerce.number().min(-90).max(90).optional(),
  pickupLng: z.coerce.number().min(-180).max(180).optional(),
  dropLat: z.coerce.number().min(-90).max(90).optional(),
  dropLng: z.coerce.number().min(-180).max(180).optional(),
  scheduledDate: z.coerce.date().optional(),
  // Admin-on-behalf only: the customer the order is for. Ignored for customers.
  customerId: z.string().uuid().optional(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;

export const orderStatusValues = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RESCHEDULED",
] as const;

export const failureReasonValues = [
  "CUSTOMER_UNAVAILABLE",
  "WRONG_ADDRESS",
  "REFUSED",
  "DAMAGED",
  "OTHER",
] as const;

export const statusUpdateSchema = z.object({
  status: z.enum(orderStatusValues),
  note: z.string().trim().max(500).optional(),
  reason: z.enum(failureReasonValues).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

export type StatusUpdateInput = z.infer<typeof statusUpdateSchema>;

export const rescheduleSchema = z.object({
  requestedDate: z.coerce.date().refine((d) => d.getTime() > Date.now() - 86_400_000, {
    message: "requestedDate must not be in the past",
  }),
  reason: z.string().trim().max(500).optional(),
});

export type RescheduleInput = z.infer<typeof rescheduleSchema>;

/** One row of an orders CSV import (customer referenced by email). */
export const orderCsvRowSchema = z.object({
  customerEmail: z.string().trim().toLowerCase().email(),
  pickupPincode: z.string().trim().regex(/^\d{4,10}$/, "invalid pincode"),
  dropPincode: z.string().trim().regex(/^\d{4,10}$/, "invalid pincode"),
  pickupAddress: z.string().trim().min(1),
  dropAddress: z.string().trim().min(1),
  lengthCm: z.coerce.number().positive(),
  breadthCm: z.coerce.number().positive(),
  heightCm: z.coerce.number().positive(),
  actualWeightKg: z.coerce.number().positive(),
  orderType: z.enum(["B2B", "B2C"]),
  paymentType: z.enum(["PREPAID", "COD"]),
});
