import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Transparent pricing",
    body: "Auto-calculated charges from admin-configurable zone rate cards, volumetric weight and COD surcharge — shown before you confirm.",
  },
  {
    title: "Intelligent assignment",
    body: "Orders go to the nearest available agent, scored by distance, zone and current load — with the reasoning made explicit.",
  },
  {
    title: "Live tracking",
    body: "Follow every order through its full lifecycle with an immutable, timestamped tracking timeline and status notifications.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-16">
      <section className="flex flex-col items-start gap-6">
        <span className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
          Logistics operations platform
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Last-Mile Delivery Tracker
        </h1>
        <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
          Create orders with auto-calculated charges, assign agents
          intelligently, and keep customers notified at every step of the
          delivery journey.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/register">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/track">Track a shipment</Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/rate-calculator">Estimate a rate</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle className="text-base">{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{f.body}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </section>

      <footer className="mt-auto text-sm text-muted-foreground">
        Transparent pricing · intelligent assignment · live tracking.
      </footer>
    </main>
  );
}
