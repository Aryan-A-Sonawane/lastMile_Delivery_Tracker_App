import type { LatLng, ZoneType } from "./types";

/**
 * Zone detection & geo helpers (pure).
 *
 * Primary zone detection is deterministic: a pincode maps to exactly one zone
 * via the admin-managed Area table. `resolveZoneIdByPincode` performs that
 * lookup given the area rows; the DB access lives in the route handler.
 */

export type AreaMapping = { pincode: string; zoneId: string };

/** Whether an order stays within one zone (INTRA) or crosses zones (INTER). */
export function resolveZoneType(
  pickupZoneId: string,
  dropZoneId: string,
): ZoneType {
  return pickupZoneId === dropZoneId ? "INTRA" : "INTER";
}

/** Resolve a pincode to its zone id, or null if the pincode is not serviced. */
export function resolveZoneIdByPincode(
  pincode: string,
  areas: AreaMapping[],
): string | null {
  const normalized = pincode.trim();
  return areas.find((a) => a.pincode === normalized)?.zoneId ?? null;
}

/** A circular zone (center + radius). Radius is already resolved (per-zone
 * override or the global default) by the caller. */
export type ZoneCircle = {
  id: string;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

/** Whether a point lies within `radiusKm` of a center (great-circle). */
export function isWithinCircle(
  point: LatLng,
  center: LatLng,
  radiusKm: number,
): boolean {
  return haversineKm(point, center) <= radiusKm;
}

/**
 * Which zone a point falls into. When circles overlap, the **smallest containing
 * circle wins** (most specific zone); ties break by nearest center. Returns null
 * if the point is outside every zone.
 */
export function zoneForPoint(
  point: LatLng,
  zones: ZoneCircle[],
): string | null {
  const containing = zones
    .map((z) => ({
      z,
      dist: haversineKm(point, { lat: z.centerLat, lng: z.centerLng }),
    }))
    .filter((c) => c.dist <= c.z.radiusKm);

  if (containing.length === 0) return null;

  containing.sort(
    (a, b) => a.z.radiusKm - b.z.radiusKm || a.dist - b.dist,
  );
  return containing[0].z.id;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points in kilometres (haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.asin(Math.sqrt(h));
}
