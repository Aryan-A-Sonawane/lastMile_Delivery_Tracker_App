import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { areaCsvRowSchema } from "@/lib/validation/config";

const bulkSchema = z.object({ rows: z.array(areaCsvRowSchema).min(1).max(5000) });

// Bulk-onboard serviceable areas: pincode → zone (by code), geo enriched from PincodeRef.
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const { rows } = bulkSchema.parse(await req.json());

  const zoneCodes = [...new Set(rows.map((r) => r.zoneCode.toUpperCase()))];
  const zones = await prisma.zone.findMany({
    where: { code: { in: zoneCodes } },
    select: { id: true, code: true },
  });
  const zoneByCode = new Map(zones.map((z) => [z.code, z.id]));

  const pincodes = [...new Set(rows.map((r) => r.pincode))];
  const refs = await prisma.pincodeRef.findMany({ where: { pincode: { in: pincodes } } });
  const refByPincode = new Map(refs.map((r) => [r.pincode, r]));

  let created = 0;
  const errors: { row: number; error: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const zoneId = zoneByCode.get(r.zoneCode.toUpperCase());
    if (!zoneId) {
      errors.push({ row: i + 1, error: `Unknown zone code "${r.zoneCode}"` });
      continue;
    }
    const ref = refByPincode.get(r.pincode);
    try {
      await prisma.area.create({
        data: {
          pincode: r.pincode,
          name: r.name ?? ref?.area ?? `Area ${r.pincode}`,
          city: ref?.city ?? null,
          state: ref?.state ?? null,
          lat: ref?.lat ?? null,
          lng: ref?.lng ?? null,
          zoneId,
        },
      });
      created++;
    } catch {
      errors.push({ row: i + 1, error: `Pincode ${r.pincode} already exists` });
    }
  }

  return NextResponse.json({ data: { created, failed: errors.length, errors } });
});
