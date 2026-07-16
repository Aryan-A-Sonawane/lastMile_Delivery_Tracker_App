import { type NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth/session";
import { withApi, notFound, conflict } from "@/lib/api/errors";
import { agentUpdateSchema } from "@/lib/validation/config";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi(async (_req: NextRequest, { params }: Ctx) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const agent = await prisma.agentProfile.findUnique({
    where: { id },
    include: {
      profile: { select: { id: true, name: true, email: true, phone: true } },
      homeZone: { select: { id: true, name: true, code: true } },
      _count: { select: { currentOrders: true, assignments: true } },
    },
  });
  if (!agent) throw notFound("Agent not found");
  return NextResponse.json({ data: agent });
});

export const PATCH = withApi(async (req: NextRequest, { params }: Ctx) => {
  await requireRole("ADMIN");
  const { id } = await params;
  const input = agentUpdateSchema.parse(await req.json());

  const agent = await prisma.agentProfile.findUnique({
    where: { id },
    select: { profileId: true },
  });
  if (!agent) throw notFound("Agent not found");

  const updated = await prisma.$transaction(async (tx) => {
    if (input.name !== undefined || input.phone !== undefined) {
      await tx.profile.update({
        where: { id: agent.profileId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
      });
    }

    const data: Prisma.AgentProfileUpdateInput = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.homeZoneId !== undefined) {
      data.homeZone = input.homeZoneId
        ? { connect: { id: input.homeZoneId } }
        : { disconnect: true };
    }
    if (input.maxActiveOrders !== undefined) data.maxActiveOrders = input.maxActiveOrders;
    if (input.currentLat !== undefined) {
      data.currentLat = input.currentLat;
      data.lastLocationAt = new Date();
    }
    if (input.currentLng !== undefined) data.currentLng = input.currentLng;
    if (input.serviceLat !== undefined) data.serviceLat = input.serviceLat;
    if (input.serviceLng !== undefined) data.serviceLng = input.serviceLng;
    if (input.serviceAddress !== undefined) data.serviceAddress = input.serviceAddress;

    return tx.agentProfile.update({
      where: { id },
      data,
      include: {
        profile: { select: { id: true, name: true, email: true, phone: true } },
        homeZone: { select: { id: true, name: true, code: true } },
      },
    });
  });

  return NextResponse.json({ data: updated });
});

export const DELETE = withApi(async (_req: NextRequest, { params }: Ctx) => {
  await requireRole("ADMIN");
  const { id } = await params;

  const agent = await prisma.agentProfile.findUnique({
    where: { id },
    select: {
      profileId: true,
      _count: { select: { assignments: true, currentOrders: true } },
    },
  });
  if (!agent) throw notFound("Agent not found");

  if (agent._count.assignments > 0 || agent._count.currentOrders > 0) {
    throw conflict(
      "Cannot delete an agent with delivery history — set them OFFLINE instead.",
    );
  }

  // Deleting the Profile cascades to the AgentProfile (onDelete: Cascade).
  await prisma.profile.delete({ where: { id: agent.profileId } });
  await createAdminClient()
    .auth.admin.deleteUser(agent.profileId)
    .catch(() => {});

  return NextResponse.json({ ok: true });
});
