import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { agentCsvRowSchema } from "@/lib/validation/config";
import { createAgent } from "@/lib/agents/create-agent";

const bulkSchema = z.object({
  rows: z.array(agentCsvRowSchema).min(1).max(500),
});

// Bulk-onboard agents from a CSV. Zones are referenced by code and resolved to ids.
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const { rows } = bulkSchema.parse(await req.json());

  const codes = [
    ...new Set(
      rows.map((r) => r.homeZoneCode?.toUpperCase()).filter(Boolean) as string[],
    ),
  ];
  const zones = await prisma.zone.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const zoneByCode = new Map(zones.map((z) => [z.code, z.id]));

  const credentials: { email: string; tempPassword: string }[] = [];
  const errors: { row: number; email: string; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      const homeZoneId = r.homeZoneCode
        ? (zoneByCode.get(r.homeZoneCode.toUpperCase()) ?? null)
        : null;
      const res = await createAgent({
        name: r.name,
        email: r.email,
        phone: r.phone,
        homeZoneId,
        maxActiveOrders: r.maxActiveOrders,
      });
      credentials.push({ email: r.email, tempPassword: res.tempPassword });
    } catch (e) {
      errors.push({
        row: i + 1,
        email: r.email,
        error: e instanceof Error ? e.message : "failed",
      });
    }
  }

  return NextResponse.json({
    data: { created: credentials.length, failed: errors.length, errors, credentials },
  });
});
