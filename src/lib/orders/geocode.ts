import { prisma } from "@/lib/prisma";

/**
 * Resolves pincodes to coordinates using our own reference data: the serviceable
 * `Area` table first (it carries lat/lng), falling back to the broader
 * `PincodeRef` dataset. Lets order creation stamp pickup/drop coordinates so the
 * assignment engine (distance, direction) and the admin map actually work even
 * when the client didn't send a precise point.
 */
export async function coordsForPincodes(
  pincodes: string[],
): Promise<Map<string, { lat: number; lng: number }>> {
  const unique = [...new Set(pincodes.map((p) => p.trim()).filter(Boolean))];
  const out = new Map<string, { lat: number; lng: number }>();
  if (unique.length === 0) return out;

  const areas = await prisma.area.findMany({
    where: { pincode: { in: unique }, lat: { not: null }, lng: { not: null } },
    select: { pincode: true, lat: true, lng: true },
  });
  for (const a of areas) {
    if (a.lat != null && a.lng != null) out.set(a.pincode, { lat: a.lat, lng: a.lng });
  }

  const missing = unique.filter((p) => !out.has(p));
  if (missing.length > 0) {
    const refs = await prisma.pincodeRef.findMany({
      where: { pincode: { in: missing } },
      select: { pincode: true, lat: true, lng: true },
    });
    for (const r of refs) out.set(r.pincode, { lat: r.lat, lng: r.lng });
  }

  return out;
}
