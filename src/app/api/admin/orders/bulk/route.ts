import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { orderCsvRowSchema } from "@/lib/validation/order";
import { createOrder } from "@/lib/orders/create-order";

const bulkSchema = z.object({ rows: z.array(orderCsvRowSchema).min(1).max(1000) });

// Bulk-create orders on behalf of customers (referenced by email).
export const POST = withApi(async (req: NextRequest) => {
  const admin = await requireRole("ADMIN");
  const { rows } = bulkSchema.parse(await req.json());

  const emails = [...new Set(rows.map((r) => r.customerEmail))];
  const customers = await prisma.profile.findMany({
    where: { email: { in: emails }, roles: { has: "CUSTOMER" } },
    select: { id: true, email: true },
  });
  const idByEmail = new Map(customers.map((c) => [c.email, c.id]));

  let created = 0;
  const errors: { row: number; email?: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const customerId = idByEmail.get(r.customerEmail);
    if (!customerId) {
      errors.push({ row: i + 1, email: r.customerEmail, error: "Unknown customer email" });
      continue;
    }
    try {
      await createOrder({
        input: {
          pickupPincode: r.pickupPincode,
          dropPincode: r.dropPincode,
          pickupAddress: r.pickupAddress,
          dropAddress: r.dropAddress,
          lengthCm: r.lengthCm,
          breadthCm: r.breadthCm,
          heightCm: r.heightCm,
          actualWeightKg: r.actualWeightKg,
          orderType: r.orderType,
          paymentType: r.paymentType,
        },
        customerId,
        createdById: admin.id,
        createdByRole: "ADMIN",
      });
      created++;
    } catch (e) {
      errors.push({
        row: i + 1,
        email: r.customerEmail,
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }

  return NextResponse.json({ data: { created, failed: errors.length, errors } });
});
