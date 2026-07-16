import Link from "next/link";
import {
  Truck,
  ArrowRight,
  Wallet,
  Route,
  MapPinned,
  BellRing,
  ShieldCheck,
  Gauge,
  PackageCheck,
  UserRound,
  Bike,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Wallet,
    tint: "text-indigo-600 bg-indigo-500/10 dark:text-indigo-300",
    title: "Transparent pricing",
    body: "Charges are computed server-side from admin-configured rate cards, volumetric weight and COD surcharge — shown before you confirm.",
  },
  {
    icon: Route,
    tint: "text-violet-600 bg-violet-500/10 dark:text-violet-300",
    title: "Intelligent assignment",
    body: "Orders route to the best available agent — scored by distance, workload, zone, route direction and rating, with the reasoning made explicit.",
  },
  {
    icon: MapPinned,
    tint: "text-sky-600 bg-sky-500/10 dark:text-sky-300",
    title: "Live map tracking",
    body: "Follow every shipment on an interactive map and a timestamped, immutable status timeline from pickup to doorstep.",
  },
  {
    icon: BellRing,
    tint: "text-amber-600 bg-amber-500/10 dark:text-amber-300",
    title: "Every-step notifications",
    body: "Customers are emailed and notified in-app at each stage — assigned, picked up, out for delivery, delivered or rescheduled.",
  },
  {
    icon: ShieldCheck,
    tint: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-300",
    title: "Reliable re-delivery",
    body: "Failed a delivery? Book a new slot within three days, up to three attempts — after which the parcel is safely returned to sender.",
  },
  {
    icon: Gauge,
    tint: "text-rose-600 bg-rose-500/10 dark:text-rose-300",
    title: "Operations analytics",
    body: "Admins get live dashboards, agent load heatmaps and zone insights to keep the whole delivery network running smoothly.",
  },
];

const roles = [
  {
    icon: UserRound,
    title: "Customers",
    body: "Get an instant quote, place an order, track it live and reschedule if needed.",
    href: "/register",
    cta: "Create an account",
  },
  {
    icon: Bike,
    title: "Delivery agents",
    body: "Set your serving area, accept assigned jobs and update delivery status on the move.",
    href: "/login",
    cta: "Agent sign in",
  },
  {
    icon: LayoutDashboard,
    title: "Operations admins",
    body: "Configure zones and pricing, assign agents on a live map, and watch the analytics.",
    href: "/login",
    cta: "Open the console",
  },
];

const stats = [
  { value: "5", label: "Delivery stages tracked" },
  { value: "3", label: "Re-delivery attempts" },
  { value: "100%", label: "Server-verified pricing" },
  { value: "Live", label: "Map + notifications" },
];

function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-brand">
            <Truck className="size-5" />
          </span>
          <span className="text-sm font-semibold">Last-Mile</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <Link href="/track" className="hover:text-foreground">Track</Link>
          <Link href="/rate-calculator" className="hover:text-foreground">Rate calculator</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <TopNav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-24 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6 py-20 text-center sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <PackageCheck className="size-3.5 text-primary" />
            Last-mile logistics, end to end
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            Deliveries that{" "}
            <span className="text-brand-gradient">track themselves</span>
          </h1>
          <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
            Instant, transparent pricing. Smart agent assignment on a live map.
            Real-time tracking and notifications at every step — for customers,
            agents and operations teams alike.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="shadow-brand">
              <Link href="/register">
                Get started <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/rate-calculator">Estimate a rate</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/track">Track a shipment</Link>
            </Button>
          </div>

          {/* Stats band */}
          <dl className="mt-10 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1 bg-card px-4 py-5">
                <dt className="text-2xl font-bold text-brand-gradient">{s.value}</dt>
                <dd className="text-center text-xs text-muted-foreground">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Everything the last mile needs</h2>
          <p className="mt-3 text-muted-foreground">
            A complete delivery platform — pricing, assignment, tracking and analytics — in one place.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <span className={`flex size-11 items-center justify-center rounded-xl ${f.tint}`}>
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Roles */}
      <section className="border-y bg-muted/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Built for every role</h2>
            <p className="mt-3 text-muted-foreground">One platform, three tailored experiences.</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.title} className="flex flex-col rounded-2xl border bg-card p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{r.title}</h3>
                  <p className="mt-2 flex-1 text-sm text-muted-foreground">{r.body}</p>
                  <Button asChild variant="ghost" className="mt-4 justify-start px-0 text-primary hover:bg-transparent hover:text-primary">
                    <Link href={r.href}>
                      {r.cta} <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-8 py-14 text-center text-white shadow-brand">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-5">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to ship smarter?
            </h2>
            <p className="text-white/85">
              Create an account and place your first tracked order in minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="secondary" className="text-primary">
                <Link href="/register">
                  Get started <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/login">Sign in</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-brand-gradient text-white">
              <Truck className="size-3.5" />
            </span>
            Last-Mile Delivery Tracker
          </div>
          <p>Transparent pricing · intelligent assignment · live tracking</p>
        </div>
      </footer>
    </div>
  );
}
