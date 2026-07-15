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

### Local dev gotcha (NAT64/IPv6)
This machine's network resolves the Supabase pooler to NAT64 IPv6 addresses that Prisma's engine can't use
(`P1001`). Local `.env` `DATABASE_URL`/`DIRECT_URL` are therefore pinned to a pooler **IPv4 + `sslmode=require`**
(hostname versions kept as comments for Vercel). If the DB becomes unreachable locally, the pinned ELB IP may
have rotated — re-resolve `aws-0-ap-southeast-1.pooler.supabase.com` (A record) and update the pin. Production
(Vercel) uses the hostname and needs no pin.
