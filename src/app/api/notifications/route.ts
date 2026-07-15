import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { withApi } from "@/lib/api/errors";

// The signed-in user's in-app notifications + unread count.
export const GET = withApi(async () => {
  const profile = await requireProfile();
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: profile.id, channel: "IN_APP" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({
      where: { userId: profile.id, channel: "IN_APP", readAt: null },
    }),
  ]);
  return NextResponse.json({ data: { items, unread } });
});
