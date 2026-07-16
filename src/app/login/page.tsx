"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_HOME, getUserRoles } from "@/lib/auth/roles";
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

type LoginAs = "CUSTOMER" | "AGENT";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginAs, setLoginAs] = useState<LoginAs>("CUSTOMER");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const roles = getUserRoles(data.user);
    let dest: string;
    if (roles.includes(loginAs)) dest = ROLE_HOME[loginAs];
    else if (roles.includes("ADMIN")) dest = ROLE_HOME.ADMIN;
    else {
      setError(
        `This account has no ${loginAs.toLowerCase()} profile. Switch, or create one from Register.`,
      );
      setLoading(false);
      return;
    }
    router.push(searchParams.get("redirectTo") || dest);
    router.refresh();
  }

  const tabs: { value: LoginAs; label: string; icon: React.ReactNode }[] = [
    { value: "CUSTOMER", label: "Customer", icon: <User className="size-4" /> },
    { value: "AGENT", label: "Agent", icon: <Truck className="size-4" /> },
  ];

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Choose how to sign in. Admins can use either.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            {tabs.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setLoginAs(t.value)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border p-2.5 text-sm font-medium transition-colors",
                  loginAs === t.value
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
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="mt-4 flex-col items-stretch gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Signing in…" : `Sign in as ${loginAs === "AGENT" ? "agent" : "customer"}`}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/register" className="underline">
              Create one
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
