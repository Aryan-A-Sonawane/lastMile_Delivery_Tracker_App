import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "password must be at least 8 characters").max(72),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[\d\s-]{7,20}$/, "invalid phone number")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1, "password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
