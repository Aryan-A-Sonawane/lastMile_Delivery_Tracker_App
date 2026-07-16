import { z } from "zod";

// Input validation for admin configuration entities. Shared by API route
// handlers and admin forms. Numeric fields are coerced so string form values
// and JSON numbers both validate.

export const orderTypeSchema = z.enum(["B2B", "B2C"]);
export const rateScopeSchema = z.enum(["INTRA", "INTER"]);
export const codModeSchema = z.enum(["FLAT", "PERCENT"]);

const optionalCoord = (min: number, max: number) =>
  z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      z.coerce.number().min(min).max(max),
    )
    .optional();

export const zoneInputSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(80),
  code: z
    .string()
    .trim()
    .min(1, "code is required")
    .max(20)
    .transform((s) => s.toUpperCase()),
  description: z.string().trim().max(500).optional().nullable(),
  centerLat: optionalCoord(-90, 90),
  centerLng: optionalCoord(-180, 180),
  radiusKm: z.coerce.number().positive().max(500).optional(),
});

export const areaInputSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/, "pincode must be 4–10 digits"),
  zoneId: z.string().min(1, "zoneId is required"),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(120).optional().nullable(),
  lat: optionalCoord(-90, 90),
  lng: optionalCoord(-180, 180),
});

export const rateCardInputSchema = z.object({
  orderType: orderTypeSchema,
  scope: rateScopeSchema,
  baseRate: z.coerce.number().nonnegative(),
  perKgRate: z.coerce.number().nonnegative(),
  minChargeableWeight: z.coerce.number().nonnegative().default(0.5),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const codConfigInputSchema = z.object({
  orderType: orderTypeSchema,
  mode: codModeSchema,
  amount: z.coerce.number().nonnegative(),
  effectiveFrom: z.coerce.date().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const settingInputSchema = z.object({
  key: z.string().trim().min(1),
  value: z.string(),
  description: z.string().trim().max(300).nullable().optional(),
});

const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const agentStatusSchema = z.enum(["AVAILABLE", "BUSY", "OFFLINE"]);

export const agentCreateSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalPhone,
  homeZoneId: z.string().optional().nullable(),
  maxActiveOrders: z.coerce.number().int().min(1).max(50).default(5),
  currentLat: optionalCoord(-90, 90),
  currentLng: optionalCoord(-180, 180),
});

export const agentUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  status: agentStatusSchema.optional(),
  homeZoneId: z.string().nullable().optional(),
  maxActiveOrders: z.coerce.number().int().min(1).max(50).optional(),
  currentLat: optionalCoord(-90, 90),
  currentLng: optionalCoord(-180, 180),
});

/** One row of an areas CSV import (zone by code; geo enriched from PincodeRef). */
export const areaCsvRowSchema = z.object({
  pincode: z.string().trim().regex(/^\d{4,10}$/, "invalid pincode"),
  zoneCode: z.string().trim().min(1),
  name: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** One row of an agents CSV import (zone referenced by human-friendly code). */
export const agentCsvRowSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalPhone,
  homeZoneCode: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  maxActiveOrders: z.coerce.number().int().min(1).max(50).optional(),
});

export type ZoneInput = z.infer<typeof zoneInputSchema>;
export type AreaInput = z.infer<typeof areaInputSchema>;
export type RateCardInput = z.infer<typeof rateCardInputSchema>;
export type CodConfigInput = z.infer<typeof codConfigInputSchema>;
export type SettingInput = z.infer<typeof settingInputSchema>;
export type AgentCreateInput = z.infer<typeof agentCreateSchema>;
export type AgentUpdateInput = z.infer<typeof agentUpdateSchema>;
