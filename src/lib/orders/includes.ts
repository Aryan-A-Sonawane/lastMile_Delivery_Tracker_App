import { Prisma } from "@prisma/client";

/** Shared select for order list rows (zones + current agent name). */
export const orderListInclude = {
  pickupZone: { select: { name: true, code: true } },
  dropZone: { select: { name: true, code: true } },
  currentAgent: { select: { id: true, profile: { select: { name: true } } } },
} satisfies Prisma.OrderInclude;

/** Shared select for order detail — adds zone centers, agent location, full
 * immutable history and customer (for the map + timeline). */
export const orderDetailInclude = {
  pickupZone: {
    select: { name: true, code: true, centerLat: true, centerLng: true },
  },
  dropZone: {
    select: { name: true, code: true, centerLat: true, centerLng: true },
  },
  currentAgent: {
    select: {
      id: true,
      currentLat: true,
      currentLng: true,
      profile: { select: { name: true } },
    },
  },
  customer: { select: { id: true, name: true, email: true, phone: true } },
  statusHistory: { orderBy: { createdAt: "asc" } },
  assignments: { orderBy: { createdAt: "asc" } },
  rescheduleRequests: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.OrderInclude;
