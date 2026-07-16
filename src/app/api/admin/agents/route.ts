import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";
import { agentCreateSchema } from "@/lib/validation/config";
import { createAgent } from "@/lib/agents/create-agent";

const agentInclude = {
  profile: { select: { id: true, name: true, email: true, phone: true } },
  homeZone: { select: { id: true, name: true, code: true } },
  _count: { select: { currentOrders: true } },
} as const;

// Agent directory with live status + load.
export const GET = withApi(async () => {
  await requireRole("ADMIN");
  const agents = await prisma.agentProfile.findMany({
    include: agentInclude,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ data: agents });
});

// Create a new agent account (Supabase user + Profile + AgentProfile + welcome email).
export const POST = withApi(async (req: NextRequest) => {
  await requireRole("ADMIN");
  const input = agentCreateSchema.parse(await req.json());
  const result = await createAgent(input);
  const agent = await prisma.agentProfile.findUnique({
    where: { id: result.agentId },
    include: agentInclude,
  });
  return NextResponse.json(
    { data: { ...agent, tempPassword: result.tempPassword } },
    { status: 201 },
  );
});
