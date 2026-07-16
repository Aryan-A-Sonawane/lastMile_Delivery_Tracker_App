import type { ActorRole, OrderStatus } from "./types";

/**
 * Order status lifecycle as an explicit state machine (pure). Every transition
 * is validated here before the route handler appends an immutable history row.
 * See docs/BLUEPRINT.md §10.
 */

export const ALL_STATUSES: OrderStatus[] = [
  "CREATED",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "FAILED",
  "RESCHEDULED",
  "RETURN_TO_SENDER",
];

type Transition = { to: OrderStatus; roles: ActorRole[] };

/** Allowed transitions per status, with the roles permitted to perform them. */
export const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  CREATED: [{ to: "ASSIGNED", roles: ["ADMIN", "SYSTEM"] }],
  ASSIGNED: [{ to: "PICKED_UP", roles: ["AGENT"] }],
  PICKED_UP: [{ to: "IN_TRANSIT", roles: ["AGENT"] }],
  IN_TRANSIT: [{ to: "OUT_FOR_DELIVERY", roles: ["AGENT"] }],
  OUT_FOR_DELIVERY: [
    { to: "DELIVERED", roles: ["AGENT"] },
    // Agents can only report a failed attempt (never cancel a job).
    { to: "FAILED", roles: ["AGENT"] },
  ],
  DELIVERED: [], // terminal
  FAILED: [
    // Customer (or admin) reschedules while attempts remain…
    { to: "RESCHEDULED", roles: ["CUSTOMER", "ADMIN"] },
    // …otherwise the shipment is returned to the sender.
    { to: "RETURN_TO_SENDER", roles: ["SYSTEM", "ADMIN"] },
  ],
  RESCHEDULED: [{ to: "ASSIGNED", roles: ["ADMIN", "SYSTEM"] }],
  RETURN_TO_SENDER: [], // terminal
};

export class InvalidTransitionError extends Error {
  constructor(from: OrderStatus, to: OrderStatus, role: ActorRole) {
    super(`Illegal transition ${from} → ${to} for role ${role}`);
    this.name = "InvalidTransitionError";
  }
}

/** A status with no outgoing transitions in the normal flow. */
export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Can `role` move an order from `from` to `to`?
 * ADMIN may force any transition (override); other roles are limited to the
 * declared transitions.
 */
export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: ActorRole,
): boolean {
  if (from === to) return false;
  if (role === "ADMIN") return true; // admin override — logged by the caller
  return TRANSITIONS[from].some(
    (t) => t.to === to && t.roles.includes(role),
  );
}

/** Statuses `role` may move an order to from `from`. */
export function allowedNextStatuses(
  from: OrderStatus,
  role: ActorRole,
): OrderStatus[] {
  if (role === "ADMIN") return ALL_STATUSES.filter((s) => s !== from);
  return TRANSITIONS[from]
    .filter((t) => t.roles.includes(role))
    .map((t) => t.to);
}

/** Throws {@link InvalidTransitionError} if the transition is not permitted. */
export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: ActorRole,
): void {
  if (!canTransition(from, to, role)) {
    throw new InvalidTransitionError(from, to, role);
  }
}
