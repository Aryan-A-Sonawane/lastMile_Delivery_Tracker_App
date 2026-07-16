# System Design — Last-Mile Delivery Tracker

*(~780 words of prose, excluding code samples. Covers the rate calculation engine, zone detection, auto-assignment, and failed-delivery handling.)*

## Architecture in one line

Next.js (App Router) hosts both the UI and the API; **pure, framework-free domain modules** hold the
graded logic; route handlers do auth + validation + orchestration; Prisma persists to Supabase Postgres.
The pure/impure split (`src/lib/domain/*` never imports Prisma or Next) is what makes the rate engine and
assignment logic unit-testable in isolation.

## Rate calculation engine

The engine is a single pure function, `computeCharge(input, config)`, with **no I/O and no lookups** — the
caller supplies the already-selected configuration. The formula:

```
volumetricWeight = (L × B × H) / volumetricDivisor          // divisor is a DB Setting, default 5000
billableWeight   = max(actualWeight, volumetricWeight, minChargeableWeight)
zoneType         = pickupZone === dropZone ? INTRA : INTER
baseCharge       = rateCard.baseRate + rateCard.perKgRate × billableWeight
codSurcharge     = COD ? (FLAT → amount | PERCENT → baseCharge × amount/100) : 0
total            = baseCharge + codSurcharge
```

**No hardcoding:** rate cards, COD surcharges, zones, areas, and even the volumetric divisor live in the
database and are edited from the admin console. The engine takes them as parameters.

**Correctness details:** money rounds to 2 dp and weights to 3 dp with an epsilon nudge to avoid binary-float
artifacts; non-positive dimensions/weight and missing configuration raise a typed `RateEngineError` (HTTP
422) rather than silently returning 0.

**Versioning + snapshots.** Rate cards and COD configs carry `effectiveFrom`/`effectiveTo`/`isActive`. A pure
resolver (`selectActiveRateCard`) picks the version in effect at order time. On order creation the server
**recomputes** the charge (never trusting a client price) and **snapshots the full breakdown** onto the order
as JSON. So changing a rate card later never rewrites the price of a historical order. The same engine powers
the public `/rate-calculator` and the order form, which show the breakdown *before* the customer confirms.

## Zone detection

Detection is **deterministic and admin-configurable**: an `Area` table maps each pincode to exactly one
`Zone`. On a quote/order, the pickup and drop pincodes are looked up (`resolveZoneIdByPincode`); an unknown
pincode yields a clear "not serviceable" error. Whether an order is **INTRA** (same zone) or **INTER** (cross
zone) is pure zone-id equality — which then selects the correct rate card. This keeps the hot path free of any
external geocoding dependency. Zones also store a center lat/lng used by the live map, and the schema leaves
room for an optional GeoJSON polygon (a point-in-polygon enhancement) without changing the core.

## Auto-assignment

Auto-assign is a **toggle** (`autoAssignEnabled`, off by default): when on, new orders are assigned on creation
and enabling it sweeps the pending backlog; when off, admins assign manually. Availability is modelled
explicitly — an agent is a candidate only if `status = AVAILABLE` **and** `activeOrders < maxActiveOrders`. The
pure `selectAgent` ranks candidates by an **explainable weighted score**:

```
score = w_distance    · 1/(1+haversineKm(agent→pickup))         // proximity (from the agent's serving location)
      + w_zone         · sameHomeZone                            // zone familiarity
      + w_workload     · (free capacity + light committed route) // least loaded
      + w_direction    · alignment(new leg, agent's heading)     // batch-friendly routing
      + w_reliability  · rating/5                                // fairness / quality
```

Distance is measured from each agent's **fixed serving location** (agent-editable; falls back to live GPS), and
direction alignment favours an agent already heading the same way. The chosen agent's full reason is stored on
the `Assignment` row, so an admin sees *why*. Manual assignment uses a **live agent map** colour-coded by load
with the top-3 suggestions listed, or a click on any free agent.

**Concurrency safety.** The claim runs inside a transaction as an **atomic conditional UPDATE**
(`… SET activeOrders = activeOrders + 1 WHERE id = ? AND status = 'AVAILABLE' AND activeOrders < maxActiveOrders`).
Zero rows affected → the agent was grabbed concurrently and the assignment fails cleanly, so two simultaneous
assignments never over-book one agent. Reaching capacity flips the agent to `BUSY`.

## Order lifecycle & immutable history

Status transitions go through a **state machine** (`CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT →
OUT_FOR_DELIVERY → DELIVERED | FAILED`, plus `FAILED → RESCHEDULED → ASSIGNED` and `FAILED → RETURN_TO_SENDER`).
Agents move an order **forward only and cannot cancel** it; admins may override to any status. **Every change
appends** a row to `OrderStatusHistory` with actor, role, timestamp, note and optional geo — an append-only
audit trail the app never mutates. Leaving an active status frees the agent's capacity. Customers see live
status via polling **plus** a Supabase Realtime broadcast for instant push updates.

## Failed-delivery handling

When an agent marks `FAILED` they **must add a remark** (with a reason: customer unavailable, wrong address,
refused, damaged, other); the customer is **notified** (email + in-app + SMS) and the agent's load is freed.
The customer (or admin) then **books re-delivery within the next 3 days**: a `RescheduleRequest` is recorded,
the order moves to `RESCHEDULED`, the attempt counter bumps, and it re-assigns — **keeping the same agent** when
they're free (route continuity), else auto-assigning a fresh one (or waiting for manual assignment). After
**3 attempts** the shipment is automatically **returned to sender** (`RETURN_TO_SENDER`, terminal). Every
attempt stays visible in the timeline.

## Notifications

A pluggable notifier fires on every status change across **branded HTML email (SMTP/Nodemailer)**, **in-app**,
and **SMS via Twilio** (mock-logged when unconfigured) behind one interface. Each message carries a unique
`idempotencyKey` (`order:status:attempt:channel`), so retries never double-send; failures are recorded and
retryable. Sending runs **after the HTTP response** (`after()`), and failed-delivery emails deep-link to the
authenticated order page (through the login gateway) so customers can book re-delivery directly.
