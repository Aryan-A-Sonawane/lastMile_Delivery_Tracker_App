"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TrackLookupPage() {
  const router = useRouter();
  const [tn, setTn] = useState("");

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Track a shipment</CardTitle>
          <CardDescription>
            Enter your tracking number to see live status and history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (tn.trim()) router.push(`/track/${encodeURIComponent(tn.trim())}`);
            }}
          >
            <Input
              placeholder="LM-XXXX-XXXX"
              value={tn}
              onChange={(e) => setTn(e.target.value)}
              className="font-mono"
            />
            <Button type="submit">Track</Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/" className="underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
