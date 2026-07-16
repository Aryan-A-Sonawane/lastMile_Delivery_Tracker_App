"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Truck } from "lucide-react";
import { api } from "@/lib/api-client";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AccountType = "CUSTOMER" | "AGENT";

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>("CUSTOMER");
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/auth/register", { ...form, accountType });
      const { error } = await createClient().auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) throw new Error(error.message);
      router.push(accountType === "AGENT" ? "/agent" : "/app");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  const types: { value: AccountType; label: string; icon: React.ReactNode }[] = [
    { value: "CUSTOMER", label: "Customer", icon: <User className="size-4" /> },
    { value: "AGENT", label: "Delivery agent", icon: <Truck className="size-4" /> },
  ];

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Choose the type of account to register.</CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setAccountType(t.value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium transition-colors",
                    accountType === t.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} required minLength={8} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone {accountType === "AGENT" && <span className="text-muted-foreground">(recommended)</span>}</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            {accountType === "AGENT" && (
              <p className="text-xs text-muted-foreground">
                Your availability, zone and location are set by an admin (or from the agent app) after you sign in.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="mt-4 flex-col items-stretch gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating…" : `Create ${accountType === "AGENT" ? "agent" : "customer"} account`}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </main>
  );
}
