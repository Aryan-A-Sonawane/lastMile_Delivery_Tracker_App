import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

// Mark all of the signed-in user's in-app notifications as read.
export const POST = withApi(async () => {
  const profile = await requireProfile();
  await prisma.notification.updateMany({
    where: { userId: profile.id, channel: "IN_APP", readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
});
