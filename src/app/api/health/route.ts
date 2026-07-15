import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe. Reports app status and, when the database is
 * configured with real credentials, a connectivity check. Returns 503 only if
 * a configured dependency is unreachable — an unconfigured DB is reported as
 * such without failing (useful before env vars are filled in).
 */
export async function GET() {
  const checks: Record<string, string> = { app: "ok" };
  let healthy = true;

  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbConfigured = dbUrl.length > 0 && !dbUrl.includes("PROJECT_REF");

  if (!dbConfigured) {
    checks.database = "not_configured";
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "unreachable";
      healthy = false;
    }
  }

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
