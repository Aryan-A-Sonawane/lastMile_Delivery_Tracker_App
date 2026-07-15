# Last-Mile Delivery Tracker

A delivery management platform where customers and admins create orders with **auto-calculated
charges**, agents are **assigned intelligently**, and customers are **notified and can track live**
at every step. Built as a full-stack logistics engineering project.

- **Live app:** _<add your Vercel URL here after deploy — see [docs/DEPLOY.md](docs/DEPLOY.md)>_
- **Demo logins** (after seeding) — password **`Password123!`**:
  - Admin — `admin@lastmile.test`
  - Agents — `agent1@lastmile.test`, `agent2@lastmile.test`, `agent3@lastmile.test`
  - Customers — `customer1@lastmile.test`, `customer2@lastmile.test`
- **Public tracking** needs no login: `/track/<TRACKING_NUMBER>`. **Rate calculator:** `/rate-calculator`.

---

## Features (mapped to the brief)

| Requirement | Where |
|---|---|
| Admin manages zones, assigns areas (pincodes) to zones | `/admin/zones`, `/admin/areas` |
| Admin configures rate cards (intra/inter × B2B/B2C) + COD surcharge — **no hardcoding** | `/admin/rate-cards`, `/admin/cod-configs`, `/admin/settings` |
| Customer registers, logs in, places an order; admin can order **on behalf of** a customer | `/register`, `/app/orders/new`, `/admin/orders/new` |
| Zone detection + volumetric weight (L×B×H÷5000) + billable = max(actual, volumetric) + rate card + COD, **shown before confirm** | `lib/domain/rate-engine.ts`, `lib/orders/pricing.ts`, `/rate-calculator` |
| Manual assign **or** auto-assign to nearest available agent | `lib/orders/assign.ts`, `/admin/orders/[id]` |
| Agent updates status (Picked Up → … → Delivered / Failed); admin override | `lib/orders/update-status.ts`, `/agent/orders/[id]` |
| Failed delivery → notify → reschedule → agent reassigned | `lib/orders/reschedule.ts`, `/app/orders/[id]` |
| Live status + **immutable** tracking timeline | `OrderStatusHistory`, polling + Supabase Realtime |
| Email **and** SMS notifications on every status change | `lib/notifications/*` (SMTP email + in-app + mock SMS) |
| Admin views all orders, filters by status/zone/agent, overrides any status | `/admin/orders` |
| **Standout:** analytics dashboard + live map | `/admin/analytics`, Leaflet map on tracking/detail |

---

## Tech stack

- **Next.js 16** (App Router, TypeScript) — one codebase for UI + API route handlers
- **Supabase** — Postgres database, Auth, Realtime (live tracking), Storage
- **Prisma 6** ORM (schema in [`prisma/schema.prisma`](prisma/schema.prisma))
- **Tailwind CSS v4 + shadcn/ui** (Radix) · **Recharts** · **Leaflet** (OpenStreetMap)
- **Zod** validation · **TanStack Query** · **Nodemailer** (SMTP email) · **Vitest**

### Architecture

The **domain logic is pure and framework-free** — [`src/lib/domain/`](src/lib/domain/) modules
(`rate-engine`, `pricing-config`, `assignment`, `zones`, `status-machine`) never import Prisma or Next.
Route handlers load config/rows from the DB, call these pure functions, then persist. This makes the
rate engine and assignment logic trivially unit-testable (see `src/lib/**/__tests__`).

```
UI (RSC + client) ──► Route handlers (auth + Zod + orchestration) ──► pure domain ──► Prisma ──► Supabase Postgres
```

---

## Getting started

### Prerequisites
- Node.js 20+ and npm
- A free **Supabase** project — see **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**

### 1. Install
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in the values (all documented in [`.env.example`](.env.example)). At minimum you need the
Supabase database URLs + API keys and (for real email) SMTP credentials. See the env reference below.

### 3. Create the schema + seed demo data
```bash
npm run db:deploy   # apply the migration (Supabase-friendly, no shadow DB)
npm run db:seed     # zones, areas, rate cards, COD, settings + demo users
```

### 4. Run
```bash
npm run dev         # http://localhost:3000
```

> **Local network note:** on some networks (NAT64/IPv6, e.g. certain ISPs) Prisma's engine can't reach
> the Supabase pooler by hostname (`P1001`). If so, pin the local `DATABASE_URL`/`DIRECT_URL` to a pooler
> **IPv4 + `sslmode=require`** (keep the hostname versions for Vercel). This does not affect production.

### Scripts
| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm run typecheck` / `lint` / `test` | TS check · ESLint · Vitest |
| `npm run db:deploy` | Apply migrations (`prisma migrate deploy`) |
| `npm run db:seed` | Seed config + demo users |
| `npm run db:studio` | Prisma Studio |

---

## Environment variables

See [`.env.example`](.env.example) for the annotated template. Summary:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** (6543, `?pgbouncer=true`) — app runtime |
| `DIRECT_URL` | Supabase **session pooler** (5432) — migrations |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only: user creation (seed/registration), Realtime broadcast |
| `SMTP_HOST/PORT/SECURE/USER/PASSWORD/FROM` | Email notifications (e.g. Gmail app password) |
| `SMS_PROVIDER` | `mock` (default) — records SMS without a paid provider |
| `NEXT_PUBLIC_APP_URL` | Base URL for tracking/email links |
| `AI_FEATURES_ENABLED` / `ANTHROPIC_API_KEY` | Optional AI features (off by default) |

---

## Rate calculation logic

Everything is **admin-configurable and stored in the database** — no hardcoded prices, zones, or the
volumetric divisor. The engine ([`src/lib/domain/rate-engine.ts`](src/lib/domain/rate-engine.ts)) is a pure
function:

```
volumetricWeight = (L × B × H) / volumetricDivisor         # divisor from Setting (default 5000)
billableWeight   = max(actualWeight, volumetricWeight, minChargeableWeight)
zoneType         = pickupZone === dropZone ? INTRA : INTER
rateCard         = active card for (orderType, zoneType)   # correct B2B/B2C + intra/inter
weightCharge     = rateCard.perKgRate × billableWeight
baseCharge       = rateCard.baseRate + weightCharge
codSurcharge     = COD ? (FLAT: amount | PERCENT: baseCharge × amount / 100) : 0
total            = baseCharge + codSurcharge
```

- **Zone detection** maps a pincode to exactly one zone via the admin-managed `Area` table
  ([`zones.ts`](src/lib/domain/zones.ts)). Unknown pincode → a clear "not serviceable" 422.
- **Rate cards & COD configs are versioned** (`effectiveFrom`/`effectiveTo`/`isActive`); the engine
  picks the active version at order time ([`pricing-config.ts`](src/lib/domain/pricing-config.ts)).
- **The charge is recomputed server-side** on order creation and the full breakdown is **snapshotted**
  immutably on the order, so historical orders stay correct even after rate cards change.
- The public **rate calculator** (`/rate-calculator`) and the order form both call `POST /api/quote`,
  which returns the full breakdown **before** the customer confirms.

Unit tests: [`rate-engine.test.ts`](src/lib/domain/__tests__/rate-engine.test.ts),
[`pricing-config.test.ts`](src/lib/domain/__tests__/pricing-config.test.ts),
[`pricing.test.ts`](src/lib/orders/__tests__/pricing.test.ts).

A fuller write-up (zone detection, auto-assignment, failed-delivery handling) is in
**[docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md)**.

---

## Database schema

12 tables (full definitions in [`prisma/schema.prisma`](prisma/schema.prisma)):

- **Profile** — app user linked 1:1 to Supabase `auth.users`; holds `role` (CUSTOMER/AGENT/ADMIN).
- **AgentProfile** — agent status, location, home zone, capacity (`activeOrders`/`maxActiveOrders`).
- **Zone**, **Area** — zones + pincode→zone mapping (zone detection source of truth).
- **RateCard**, **CodConfig** — versioned pricing (per orderType × scope / per orderType).
- **Setting** — global key/value (e.g. `volumetricDivisor`, `currency`).
- **Order** — addresses, package, weights, `orderType`, `paymentType`, immutable `chargeBreakdown`
  snapshot, `totalCharge`, `status`, `currentAgentId`, `attemptNumber`.
- **OrderStatusHistory** — *append-only* audit log (status, actor, role, timestamp, note, reason, geo).
- **Assignment** — *append-only* record of each (re)assignment with the auto-assign reasoning.
- **RescheduleRequest** — captured new date + reason on failed deliveries.
- **Notification** — outbox with a unique `idempotencyKey` (email / in-app / SMS).

---

## API documentation

All handlers validate input with Zod and return errors as `{ error, details? }`. Auth is enforced
server-side per role.

### Public
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create a customer account |
| `POST` | `/api/quote` | Rate estimate (no persistence) — full breakdown |
| `GET` | `/api/track/[trackingNumber]` | Public tracking (status + timeline + zones + agent) |
| `GET` | `/api/health` | Liveness + DB check |

### Customer / Agent / Admin (authenticated)
| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/orders` | any | List orders (scoped to role; admin filters `status/zoneId/agentId`) |
| `POST` | `/api/orders` | customer/admin | Create order (admin passes `customerId`) |
| `GET` | `/api/orders/[id]` | owner/assigned/admin | Order detail + history |
| `POST` | `/api/orders/[id]/assign` | admin | Assign agent (`{mode:"MANUAL",agentId}` or `{mode:"AUTO"}`) |
| `POST` | `/api/orders/[id]/status` | agent/admin | Update status (`{status,note?,reason?,lat?,lng?}`) |
| `POST` | `/api/orders/[id]/reschedule` | customer/admin | Reschedule failed order (`{requestedDate,reason?}`) |
| `GET` | `/api/notifications` · `POST .../read` | any | In-app notifications + mark read |

### Admin configuration
`GET/POST /api/admin/{zones,areas,rate-cards,cod-configs}` · `PATCH/DELETE /api/admin/{…}/[id]` ·
`GET/PUT /api/admin/settings` · `GET /api/admin/customers` · `GET /api/admin/agents` ·
`GET /api/admin/analytics`.

---

## Testing

```bash
npm run test        # Vitest — pure domain logic (rate engine, pricing config, assignment, status machine, tracking)
```

The graded rate engine has a table-driven suite covering volumetric-vs-actual selection, INTRA/INTER,
B2B/B2C, COD flat/percent, min-chargeable weight, and error cases.

---

## Deployment

Deploy the app to **Vercel** and point it at the same Supabase project. Full steps (env vars, and using
the hostname URLs in production vs the local IPv4 pin) are in **[docs/DEPLOY.md](docs/DEPLOY.md)**.

---

## Project docs
- [docs/BLUEPRINT.md](docs/BLUEPRINT.md) — full design & phased plan
- [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) — ≤800-word system-design write-up
- [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) — Supabase project setup
- [docs/DEPLOY.md](docs/DEPLOY.md) — Vercel deployment
