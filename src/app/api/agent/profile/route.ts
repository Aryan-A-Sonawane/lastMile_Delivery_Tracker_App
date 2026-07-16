import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi, notFound } from "@/lib/api/errors";
import { agentSelfUpdateSchema } from "@/lib/validation/config";

const selfInclude = {
  profile: { select: { id: true, name: true, email: true, phone: true } },
  homeZone: { select: { id: true, name: true, code: true } },
  _count: { select: { currentOrders: true } },
} as const;

// The signed-in agent's own profile (serving location, availability, load).
export const GET = withApi(async () => {
  const me = await requireRole("AGENT");
  const agent = await prisma.agentProfile.findUnique({
    where: { profileId: me.id },
    include: selfInclude,
  });
  if (!agent) throw notFound("Agent profile not found");
  return NextResponse.json({ data: agent });
});

// The agent edits their serving location / availability / live location.
export const PATCH = withApi(async (req: NextRequest) => {
  const me = await requireRole("AGENT");
  const input = agentSelfUpdateSchema.parse(await req.json());

  const agent = await prisma.agentProfile.findUnique({
    where: { profileId: me.id },
    select: { id: true },
  });
  if (!agent) throw notFound("Agent profile not found");

  const data: Prisma.AgentProfileUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.serviceLat !== undefined) data.serviceLat = input.serviceLat;
  if (input.serviceLng !== undefined) data.serviceLng = input.serviceLng;
  if (input.serviceAddress !== undefined) data.serviceAddress = input.serviceAddress;
  if (input.currentLat !== undefined) {
    data.currentLat = input.currentLat;
    data.lastLocationAt = new Date();
  }
  if (input.currentLng !== undefined) data.currentLng = input.currentLng;

  const updated = await prisma.agentProfile.update({
    where: { id: agent.id },
    data,
    include: selfInclude,
  });
  return NextResponse.json({ data: updated });
});
