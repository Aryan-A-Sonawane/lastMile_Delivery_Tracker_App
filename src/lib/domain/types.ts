// Shared domain types for the pure, framework-free domain modules
// (rate-engine, zones, assignment, status-machine). These modules must never
// import Prisma or Next — route handlers map DB rows onto these types.

export type OrderType = "B2B" | "B2C";
export type PaymentType = "PREPAID" | "COD";
export type ZoneType = "INTRA" | "INTER";

export type OrderStatus =
  | "CREATED"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "FAILED"
  | "RESCHEDULED"
  | "RETURN_TO_SENDER";

/** Who performed an action. Mirrors the auth `Role` union. */
export type ActorRole = "CUSTOMER" | "AGENT" | "ADMIN" | "SYSTEM";

/** A latitude/longitude pair (decimal degrees). */
export type LatLng = { lat: number; lng: number };
