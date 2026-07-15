/**
 * Seed script — populates admin-configurable data and demo users.
 *
 * Run with:  npx prisma db seed   (loads .env, then runs `tsx prisma/seed.ts`)
 *
 * Config data (settings, zones, areas, rate cards, COD configs) only needs the
 * database. Demo users additionally need Supabase service-role credentials; if
 * those are absent/placeholder, user seeding is skipped with a warning so the
 * config seed still succeeds.
 */
import { PrismaClient, type Role } from "@prisma/client";
import { createAdminClient, hasSupabaseAdminCreds } from "../src/lib/supabase/admin";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

async function seedSettings() {
  const settings = [
    { key: "volumetricDivisor", value: "5000", description: "Divisor for volumetric weight (L×B×H ÷ divisor)" },
    { key: "currency", value: "INR", description: "Display currency for charges" },
  ];
  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: s,
      update: { value: s.value, description: s.description },
    });
  }
  console.log(`✓ settings (${settings.length})`);
}

async function seedZonesAndAreas() {
  const zones = [
    { code: "BLR-N", name: "North Bengaluru", centerLat: 13.05, centerLng: 77.59, pincodes: ["560001", "560003", "560024"] },
    { code: "BLR-S", name: "South Bengaluru", centerLat: 12.9, centerLng: 77.6, pincodes: ["560004", "560011", "560041"] },
    { code: "BLR-E", name: "East Bengaluru", centerLat: 12.97, centerLng: 77.7, pincodes: ["560037", "560048", "560066"] },
  ];

  for (const z of zones) {
    const zone = await prisma.zone.upsert({
      where: { code: z.code },
      create: { code: z.code, name: z.name, centerLat: z.centerLat, centerLng: z.centerLng },
      update: { name: z.name, centerLat: z.centerLat, centerLng: z.centerLng },
    });
    for (const pincode of z.pincodes) {
      await prisma.area.upsert({
        where: { pincode },
        create: { pincode, name: `${z.name} ${pincode}`, zoneId: zone.id },
        update: { name: `${z.name} ${pincode}`, zoneId: zone.id },
      });
    }
  }
  console.log(`✓ zones (${zones.length}) + areas (${zones.reduce((n, z) => n + z.pincodes.length, 0)})`);
}

async function seedRateCards() {
  const cards = [
    { orderType: "B2C" as const, scope: "INTRA" as const, baseRate: 40, perKgRate: 15, minChargeableWeight: 0.5 },
    { orderType: "B2C" as const, scope: "INTER" as const, baseRate: 60, perKgRate: 25, minChargeableWeight: 0.5 },
    { orderType: "B2B" as const, scope: "INTRA" as const, baseRate: 80, perKgRate: 12, minChargeableWeight: 1 },
    { orderType: "B2B" as const, scope: "INTER" as const, baseRate: 120, perKgRate: 20, minChargeableWeight: 1 },
  ];
  for (const c of cards) {
    const existing = await prisma.rateCard.findFirst({
      where: { orderType: c.orderType, scope: c.scope, isActive: true },
    });
    if (!existing) await prisma.rateCard.create({ data: c });
  }
  console.log(`✓ rate cards (${cards.length})`);
}

async function seedCodConfigs() {
  const configs = [
    { orderType: "B2C" as const, mode: "FLAT" as const, amount: 30 },
    { orderType: "B2B" as const, mode: "PERCENT" as const, amount: 2 },
  ];
  for (const c of configs) {
    const existing = await prisma.codConfig.findFirst({
      where: { orderType: c.orderType, isActive: true },
    });
    if (!existing) await prisma.codConfig.create({ data: c });
  }
  console.log(`✓ COD configs (${configs.length})`);
}

async function seedUsers() {
  if (!hasSupabaseAdminCreds()) {
    console.warn(
      "⚠ Skipping user seed — Supabase service-role creds not configured. " +
        "Set NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and re-run.",
    );
    return;
  }

  const supabase = createAdminClient();

  // Look up an existing auth user by email (list is small in demo projects).
  async function findAuthUserId(email: string): Promise<string | null> {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
  }

  async function ensureUser(email: string, name: string, role: Role): Promise<string> {
    let id = await findAuthUserId(email);
    if (!id) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name },
        app_metadata: { role },
      });
      if (error) throw error;
      id = data.user.id;
    } else {
      // Keep role claim in sync for existing users.
      await supabase.auth.admin.updateUserById(id, { app_metadata: { role } });
    }
    await prisma.profile.upsert({
      where: { id },
      create: { id, email, name, role },
      update: { name, role },
    });
    return id;
  }

  await ensureUser("admin@lastmile.test", "Ava Admin", "ADMIN");
  await ensureUser("customer1@lastmile.test", "Chloe Customer", "CUSTOMER");
  await ensureUser("customer2@lastmile.test", "Cyrus Customer", "CUSTOMER");

  const agents = [
    { email: "agent1@lastmile.test", name: "Arun Agent", zoneCode: "BLR-N", lat: 13.05, lng: 77.59 },
    { email: "agent2@lastmile.test", name: "Bina Agent", zoneCode: "BLR-S", lat: 12.9, lng: 77.6 },
    { email: "agent3@lastmile.test", name: "Kiran Agent", zoneCode: "BLR-E", lat: 12.97, lng: 77.7 },
  ];
  for (const a of agents) {
    const id = await ensureUser(a.email, a.name, "AGENT");
    const zone = await prisma.zone.findUnique({ where: { code: a.zoneCode } });
    await prisma.agentProfile.upsert({
      where: { profileId: id },
      create: {
        profileId: id,
        status: "AVAILABLE",
        homeZoneId: zone?.id ?? null,
        currentLat: a.lat,
        currentLng: a.lng,
        lastLocationAt: new Date(),
      },
      update: {
        status: "AVAILABLE",
        homeZoneId: zone?.id ?? null,
        currentLat: a.lat,
        currentLng: a.lng,
      },
    });
  }
  console.log(`✓ users: 1 admin, 2 customers, ${agents.length} agents (password: ${DEMO_PASSWORD})`);
}

async function main() {
  console.log("Seeding…");
  await seedSettings();
  await seedZonesAndAreas();
  await seedRateCards();
  await seedCodConfigs();
  await seedUsers();
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
