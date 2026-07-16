/**
 * Seeds realistic demo orders spread over the last 90 days.
 *
 * Usage:  npx tsx prisma/seed-orders.ts [count]   (default 1000)
 *         npm run db:seed-orders
 *
 * Requires the config seed to have run first (customers, agents, serviceable
 * Areas). Historical orders (age > 3d) reach a terminal state (mostly delivered,
 * some failed → rescheduled → delivered); recent orders stay in-flight. Agent
 * capacity is temporarily lifted during seeding, then load/status is recomputed.
 */
import { PrismaClient, type OrderStatus } from "@prisma/client";
import { createOrder } from "../src/lib/orders/create-order";
import { assignAgent } from "../src/lib/orders/assign";
import { updateOrderStatus } from "../src/lib/orders/update-status";
import { rescheduleOrder } from "../src/lib/orders/reschedule";
import type { OrderCreateInput } from "../src/lib/validation/order";

process.loadEnvFile();
const prisma = new PrismaClient();

const ORDER_TYPES = ["B2B", "B2C"] as const;
const PAYMENT_TYPES = ["PREPAID", "COD"] as const;
const FAILURE_REASONS = [
  "CUSTOMER_UNAVAILABLE",
  "WRONG_ADDRESS",
  "REFUSED",
  "DAMAGED",
  "OTHER",
] as const;
const IN_FLIGHT: OrderStatus[] = [
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "RESCHEDULED",
];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const round2 = (n: number) => Math.round(n * 100) / 100;
const DAY = 86_400_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      console.warn(`retry ${i}/${attempts} after: ${(e as Error).message.slice(0, 80)}`);
      await sleep(1500 * i);
    }
  }
}

async function progress(
  orderId: string,
  actorProfileId: string,
  statuses: OrderStatus[],
) {
  for (const s of statuses) {
    await updateOrderStatus({
      orderId,
      toStatus: s,
      actorProfileId,
      actorRole: "AGENT",
      ...(s === "FAILED" ? { reason: pick(FAILURE_REASONS) } : {}),
    });
  }
}

async function main() {
  const total = Number(process.argv[2] ?? 1000);
  const [customers, agents, admin, areas] = await withRetry(() =>
    Promise.all([
      prisma.profile.findMany({ where: { role: "CUSTOMER" }, select: { id: true } }),
      prisma.agentProfile.findMany({ select: { id: true, profileId: true } }),
      prisma.profile.findFirst({ where: { role: "ADMIN" }, select: { id: true } }),
      prisma.area.findMany({ select: { pincode: true } }),
    ]),
  );
  if (!customers.length || !agents.length || !admin || !areas.length) {
    throw new Error("Seed prerequisites missing (customers / agents / admin / serviceable areas).");
  }

  const profileByAgent = new Map(agents.map((a) => [a.id, a.profileId]));
  const agentIds = agents.map((a) => a.id);

  // Lift capacity so assignment never blocks mid-seed; restored at the end.
  await prisma.agentProfile.updateMany({ data: { maxActiveOrders: 1_000_000 } });

  const now = new Date();
  const start = new Date(now.getTime() - 90 * DAY);

  let created = 0;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const customerId = pick(customers).id;
    const pickup = pick(areas).pincode;
    const drop = pick(areas).pincode;
    const orderDate = new Date(start.getTime() + Math.random() * (now.getTime() - start.getTime()));
    const ageDays = (now.getTime() - orderDate.getTime()) / DAY;
    const roll = Math.random();

    try {
      const input: OrderCreateInput = {
        pickupPincode: pickup,
        dropPincode: drop,
        pickupAddress: `Pickup near ${pickup}`,
        dropAddress: `Drop near ${drop}`,
        lengthCm: round2(rand(10, 60)),
        breadthCm: round2(rand(10, 60)),
        heightCm: round2(rand(10, 60)),
        actualWeightKg: round2(rand(0.5, 20)),
        orderType: pick(ORDER_TYPES),
        paymentType: pick(PAYMENT_TYPES),
      };
      const order = await createOrder({
        input,
        customerId,
        createdById: customerId,
        createdByRole: "CUSTOMER",
      });

      const agentId = pick(agentIds);
      const actor = profileByAgent.get(agentId)!;

      if (ageDays > 3) {
        await assignAgent({ orderId: order.id, mode: "MANUAL", agentId, assignedById: admin.id });
        if (roll < 0.82) {
          await progress(order.id, actor, ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]);
        } else {
          await progress(order.id, actor, ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "FAILED"]);
          await rescheduleOrder({
            orderId: order.id,
            requestedDate: new Date(orderDate.getTime() + 2 * DAY),
            reason: "Customer requested a new slot",
            actorProfileId: customerId,
            actorRole: "CUSTOMER",
          });
          const other = agentIds.filter((id) => id !== agentId);
          const agent2 = other.length ? pick(other) : agentId;
          const actor2 = profileByAgent.get(agent2)!;
          await assignAgent({ orderId: order.id, mode: "MANUAL", agentId: agent2, assignedById: admin.id, excludeAgentId: agentId });
          await progress(order.id, actor2, ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"]);
        }
      } else if (roll >= 0.2) {
        // Recent → in-flight at a random stage.
        await assignAgent({ orderId: order.id, mode: "MANUAL", agentId, assignedById: admin.id });
        const mid: OrderStatus[] = ["PICKED_UP", "IN_TRANSIT", "OUT_FOR_DELIVERY"];
        await progress(order.id, actor, mid.slice(0, randInt(0, 3)));
      }
      // else: recent + roll < 0.2 → left CREATED (pending assignment)

      // Backdate the order + its history to its order date.
      await prisma.order.update({ where: { id: order.id }, data: { createdAt: orderDate, updatedAt: orderDate } });
      await prisma.orderStatusHistory.updateMany({ where: { orderId: order.id }, data: { createdAt: orderDate } });

      created++;
      if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${total} …`);
    } catch (e) {
      failed++;
      console.error(`order ${i + 1} failed:`, (e as Error).message);
    }
  }

  // Restore capacity + recompute each agent's live load/status from in-flight orders.
  for (const a of agents) {
    const load = await withRetry(() =>
      prisma.order.count({
        where: { currentAgentId: a.id, status: { in: IN_FLIGHT } },
      }),
    );
    await withRetry(() =>
      prisma.agentProfile.update({
        where: { id: a.id },
        data: {
          maxActiveOrders: 25,
          activeOrders: load,
          status: load >= 25 ? "BUSY" : "AVAILABLE",
        },
      }),
    );
  }

  console.log(`Done. created=${created} failed=${failed}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
