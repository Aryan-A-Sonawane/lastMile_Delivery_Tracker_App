/**
 * Loads the India pincode reference dataset into `PincodeRef`.
 *
 * Usage:  npx tsx prisma/seed-pincodes.ts [path-to-json]
 *   default path: prisma/data/pincodes.json
 *
 * Expects a JSON array of rows. Common column-name variants are tolerated:
 *   pincode | pin
 *   area | officename | office | name
 *   city | district | state
 *   lat | latitude   /   lng | long | longitude
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

process.loadEnvFile();
// Use the session pooler (DIRECT_URL) — a stable dedicated connection is more
// reliable for a sustained bulk load than the transaction pooler.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

type RawRow = Record<string, unknown>;
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => Number(v);
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

async function main() {
  const path = process.argv[2] ?? "prisma/data/pincodes.json";
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawRow[];
  if (!Array.isArray(raw)) throw new Error("Expected a JSON array of pincode rows");

  const rows = raw
    .map((r) => ({
      pincode: str(r.pincode ?? r.pin ?? r.Pincode),
      area: str(r.area ?? r.areaName ?? r.areaname ?? r.officename ?? r.office ?? r.name ?? r.Area),
      city: str(r.city ?? r.City) || null,
      district: str(r.district ?? r.District) || null,
      state: str(r.state ?? r.State) || null,
      lat: num(r.lat ?? r.latitude ?? r.Latitude),
      lng: num(r.lng ?? r.long ?? r.longitude ?? r.Longitude),
    }))
    .filter(
      (r) =>
        r.pincode && r.area && Number.isFinite(r.lat) && Number.isFinite(r.lng),
    );

  // De-duplicate by pincode (keep the first occurrence).
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(r.pincode) ? false : seen.add(r.pincode)));

  const CHUNK = 400;
  let inserted = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const res = await withRetry(() =>
      prisma.pincodeRef.createMany({
        data: unique.slice(i, i + CHUNK),
        skipDuplicates: true,
      }),
    );
    inserted += res.count;
  }

  console.log(`✓ Loaded ${inserted} pincodes (from ${unique.length} unique rows in ${raw.length} total).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
