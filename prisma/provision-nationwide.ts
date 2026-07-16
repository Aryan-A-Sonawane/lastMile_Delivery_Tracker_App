/**
 * Provisions nationwide coverage from the loaded PincodeRef dataset:
 *   • one circular zone per city (center = mean of its pincodes, radius sized to fit)
 *   • every pincode onboarded as a serviceable Area in its city zone
 * Existing zones/areas are preserved (createMany skipDuplicates). Run AFTER
 * db:seed-pincodes. Then re-seed orders to spread them across India.
 *
 * Usage:  npx tsx prisma/provision-nationwide.ts   (npm run db:provision)
 */
import { PrismaClient } from "@prisma/client";

process.loadEnvFile();
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      console.warn(`  retry ${i}/${attempts}: ${(e as Error).message.slice(0, 70)}`);
      await sleep(1000 * i);
    }
  }
}

const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
function slug(s: string) {
  return (
    s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 14) ||
    "ZONE"
  );
}

async function main() {
  const refs = await withRetry(() => prisma.pincodeRef.findMany());
  console.log(`Loaded ${refs.length} pincodes.`);

  // Group by state|city.
  type Group = { city: string; state: string | null; pins: typeof refs };
  const groups = new Map<string, Group>();
  for (const r of refs) {
    const key = `${r.state ?? ""}|${r.city ?? r.area}`;
    let g = groups.get(key);
    if (!g) {
      g = { city: r.city ?? r.area, state: r.state, pins: [] };
      groups.set(key, g);
    }
    g.pins.push(r);
  }

  // Deterministic zone code per city (idempotent across re-runs). Cities whose
  // slug collides are disambiguated by a state suffix.
  const slugCount = new Map<string, number>();
  for (const g of groups.values()) {
    const s = slug(g.city);
    slugCount.set(s, (slugCount.get(s) ?? 0) + 1);
  }

  const zoneDefs = [...groups.values()].map((g) => {
    const centerLat = g.pins.reduce((a, p) => a + p.lat, 0) / g.pins.length;
    const centerLng = g.pins.reduce((a, p) => a + p.lng, 0) / g.pins.length;
    const maxDist = Math.max(
      ...g.pins.map((p) => haversineKm(centerLat, centerLng, p.lat, p.lng)),
      0,
    );
    const radiusKm = Math.min(45, Math.max(12, Math.ceil(maxDist * 1.1)));
    const base = slug(g.city);
    const code =
      (slugCount.get(base) ?? 0) > 1
        ? `${base}-${slug(g.state ?? "XX").slice(0, 3)}`
        : base;
    return { code, name: g.city, centerLat, centerLng, radiusKm, pins: g.pins };
  });

  // Create zones (skip existing codes).
  await withRetry(() =>
    prisma.zone.createMany({
      data: zoneDefs.map((z) => ({
        code: z.code,
        name: z.name,
        centerLat: z.centerLat,
        centerLng: z.centerLng,
        radiusKm: z.radiusKm,
      })),
      skipDuplicates: true,
    }),
  );
  const zones = await withRetry(() =>
    prisma.zone.findMany({
      where: { code: { in: zoneDefs.map((z) => z.code) } },
      select: { id: true, code: true },
    }),
  );
  const idByCode = new Map(zones.map((z) => [z.code, z.id]));
  console.log(`Zones: ${zoneDefs.length} cities.`);

  // Onboard areas (skip pincodes already serviced).
  const areas = zoneDefs.flatMap((z) =>
    z.pins.map((p) => ({
      pincode: p.pincode,
      name: p.area,
      city: p.city,
      state: p.state,
      lat: p.lat,
      lng: p.lng,
      zoneId: idByCode.get(z.code)!,
    })),
  );

  const CHUNK = 150;
  let inserted = 0;
  for (let i = 0; i < areas.length; i += CHUNK) {
    const res = await withRetry(() =>
      prisma.area.createMany({ data: areas.slice(i, i + CHUNK), skipDuplicates: true }),
    );
    inserted += res.count;
  }

  console.log(`Areas onboarded: ${inserted} (of ${areas.length}).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
