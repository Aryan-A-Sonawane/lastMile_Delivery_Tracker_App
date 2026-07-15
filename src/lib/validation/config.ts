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
});

export const areaInputSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{4,10}$/, "pincode must be 4–10 digits"),
  zoneId: z.string().min(1, "zoneId is required"),
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

export type ZoneInput = z.infer<typeof zoneInputSchema>;
export type AreaInput = z.infer<typeof areaInputSchema>;
export type RateCardInput = z.infer<typeof rateCardInputSchema>;
export type CodConfigInput = z.infer<typeof codConfigInputSchema>;
export type SettingInput = z.infer<typeof settingInputSchema>;
