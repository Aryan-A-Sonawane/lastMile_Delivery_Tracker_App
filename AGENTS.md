<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

> Notably in this repo: the request-interception file convention is **`src/proxy.ts`** exporting a `proxy` function — the old `middleware.ts`/`middleware` export is deprecated.
<!-- END:nextjs-agent-rules -->

# Last-Mile Delivery Tracker — agent guide

Recruitment take-home assignment. The authoritative spec, data
model, engine formulas, phased plan and standout features live in
**[docs/BLUEPRINT.md](docs/BLUEPRINT.md)** — read it before building. The original
brief is `docs/ASSIGNMENT_BRIEF.pdf`.

## Stack (as built)
Next.js 16 (App Router, TS) · Tailwind v4 + shadcn/ui (Radix) · **Prisma 6** over
**Supabase Postgres** · **Supabase Auth** (`@supabase/ssr`) + Realtime + Storage ·
Zod · TanStack Query · Leaflet · Recharts · **Nodemailer (SMTP)** email · Vitest.
AI features (Anthropic) are a feature-flagged stretch.

## Commands
- `npm run dev` — dev server
- `npm run build` — production build (must stay green)
- `npm run typecheck` / `npm run lint` — TS + ESLint (must stay green)
- `npm run test` — Vitest (domain logic; must stay green)
- `npm run db:migrate` / `db:push` / `db:seed` / `db:studio` — Prisma (needs real `.env`)

## Architecture rules (do not break)
1. **Pure domain modules** in `src/lib/domain/` (`rate-engine`, `assignment`,
   `zones`, `status-machine`) are framework-free — never import Prisma/Next there.
   Route handlers load config + rows, call these pure functions, then persist.
2. **No hardcoding** of prices, zones, divisors, COD — all come from the DB
   (`RateCard`, `CodConfig`, `Setting`, `Area`). The rate engine is the #1 graded item.
3. **Recompute charges server-side**; never trust a client-sent price. The order
   stores an immutable `chargeBreakdown` snapshot.
4. **Immutable history**: status changes append to `OrderStatusHistory` (with
   actor + timestamp) via the state machine; never update/delete history rows.
5. **Money** as Decimal/integer-minor-units — avoid float drift.
6. Validate all input with **Zod**. Enforce authz server-side (don't rely on the proxy alone).
7. Keep the tree deployable; commit one coherent slice per phase.

## Status
Phases 0–8 complete (all LIVE-verified against Supabase) — **entire PDF feature spec + Tier-1 standout done**:
- **0 Scaffold** — app boots, `/api/health`, domain modules, proxy.
- **1 Data & config** — full Prisma schema (12 tables), admin config API + `/admin` console, seed script.
- **2 Rate engine** — `orders/pricing.ts` wired to DB config, public `POST /api/quote` + `/rate-calculator` UI.
- **3 Auth + orders** — Supabase auth (register/login/logout, role via app_metadata), `POST/GET /api/orders`
  (customer + admin-on-behalf, charge snapshot, tracking #, CREATED history), customer/agent/admin order
  UIs, public `/track/[trackingNumber]`.
- **4 Assignment** — `orders/assign.ts` (atomic claim, manual + auto), `/api/orders/[id]/assign`, admin assign
  panel with explainable reason, `/admin/agents`.
- **5 Lifecycle + live tracking** — `orders/update-status.ts`, `/api/orders/[id]/status`, StatusUpdatePanel,
  polling + **Supabase Realtime broadcast** (`lib/realtime/*`).
- **6 Failed delivery** — `orders/reschedule.ts`, `/api/orders/[id]/reschedule` (reschedule + auto-reassign
  excluding the failed agent, attempt bump), ReschedulePanel.
- **7 Notifications** — `lib/notifications/*` (real SMTP email + in-app + mock SMS), idempotent, fired on every
  status change; `/api/notifications` + NotificationBell.
- **8 Standout** — admin analytics dashboard (`/admin/analytics`, Recharts) + live Leaflet map on track/detail.
- **9 Deliverables** — README, `docs/SYSTEM_DESIGN.md` (~690 words), `docs/DEPLOY.md`, `postinstall: prisma generate`.
  **Remaining: actual Vercel deploy (hosted URL) — needs user's Vercel account.**

47 unit tests green. Smoke-tested end-to-end: health=DB ok, `/api/quote` correct charges, order creation writes
snapshot+immutable history, public `/api/track` works, auth guards 401 without session, admin session reads
`/api/admin/zones`=200, auto-assign picks same-zone agent + atomic load, full agent status progression frees
load, illegal transitions blocked, Realtime subscriber receives pushes.
**Remaining: Phase 8 (analytics + map standout), Phase 9 (README + 800-word design doc + Vercel deploy —
REQUIRED deliverables), Phase 10 (AI stretch).** See BLUEPRINT §15.

### Admin panel overhaul (in progress)
Decisions locked with the user:
- **Location model = static India pincode dataset.** `PincodeRef` table holds `{pincode, area, city, district,
  state, lat, lng}` (seed from a public dataset → `prisma/data/pincodes.json`, generated externally). Zones are
  **circles** (`Zone.radiusKm`, per-zone override; global default = `defaultZoneRadiusKm` Setting). Point-in-circle
  detection: `zoneForPoint` / `isWithinCircle` in `domain/zones.ts` (**smallest containing circle wins**). Order-time
  detection still uses the deterministic `Area.pincode → zoneId` lookup; circles power the admin map UX + heatmap.
  `Area` now carries `city/state/lat/lng` (filled from PincodeRef on onboarding).
- **Design system:** responsive **AdminShell** (`components/admin/admin-shell.tsx`, sidebar → mobile `Sheet` drawer)
  + shared primitives in `components/common/` (`PageHeader`, `StatCard`, `EmptyState`). Build every admin tab
  mobile-first on these. shadcn added: sheet, switch, command, popover, tooltip.
- **CSV import** (`CsvImport` — to build): reuse for **areas** (bulk pincode→zone), **agents**, **orders**, rate cards.
- **Zone radius:** variable per-zone + global default; overlap tiebreak = smallest circle, then nearest center.

**Admin overhaul — ALL DONE (live-verified):**
- ✅ Foundation: responsive `AdminShell` + `components/common/*` primitives + location model (PincodeRef, circular
  zones, `zoneForPoint`).
- ✅ **Zones** (`admin/zones` + `ZoneMap`, pin+radius). ✅ **Areas** (fuzzy `PincodeRef` search + containment +
  create-zone; `/api/admin/pincodes/{search,facets}`).
- ✅ **Agents** (CRUD, clickable rows→orders, `create-agent.ts` w/ temp-password email, delete guard).
- ✅ **Analytics v2** (`/api/admin/analytics` with from/to/granularity + deltas + timeseries + top agents; page with
  period/granularity filters, gradient area charts, clickable KPIs). ✅ Admin orders read URL filters (Suspense).
- ✅ **Heatmap** (`admin/heatmap` + `heat-map.tsx` leaflet.heat; `/api/admin/analytics/heatmap`; metric/period + legend).
- ✅ **Admin invites** (`/api/admin/admins`, `create-admin.ts` create-or-promote; Administrators section in Settings; revoke=demote).
- ✅ **Active toggles** on rate cards + COD (`ResourceManager` `toggle` prop + Switch).
- ✅ **Reusable `CsvImport`** (`components/common/csv-import.tsx`, papaparse) wired into **Agents / Areas / Orders**
  (`/api/admin/{agents,areas,orders}/bulk`).

**Data scripts (run in order):**
1. `npm run db:seed` — config + demo users (idempotent).
2. `npm run db:seed-pincodes` — loads `prisma/data/pincodes.json` into `PincodeRef` (1,391 across 13 states).
3. `npm run db:provision` — nationwide: one circular zone per city + all pincodes as serviceable Areas (idempotent,
   deterministic zone codes). → 37 zones, 1,391 areas.
4. `npm run db:seed-orders [n]` — ~n realistic orders over 90 days across serviceable areas (fixed to real APIs).

**Bulk-load stability:** on this NAT64 network the transaction pooler drops connections under sustained writes, so
`seed-pincodes`/`provision` use the **session pooler** (`DIRECT_URL`) + per-chunk retry. `seed-orders` per-order
try/catch tolerates transient drops (some orders skip). 55 tests green. Order-time zone detection stays deterministic
(`Area.pincode → zone`).

## Local dev gotcha (NAT64/IPv6)
This machine's network resolves the Supabase pooler to NAT64 IPv6 addresses that Prisma's engine can't use
(`P1001`). Local `.env` `DATABASE_URL`/`DIRECT_URL` are therefore pinned to a pooler **IPv4 + `sslmode=require`**
(hostname versions kept as comments for Vercel). If the DB becomes unreachable locally, the pinned ELB IP may
have rotated — re-resolve `aws-0-ap-southeast-1.pooler.supabase.com` (A record) and update the pin. Production
(Vercel) uses the hostname and needs no pin.
