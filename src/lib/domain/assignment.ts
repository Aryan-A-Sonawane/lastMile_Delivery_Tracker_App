import type { LatLng } from "./types";
import { haversineKm } from "./zones";

/**
 * Auto-assignment engine (pure). Selects the best available delivery agent for
 * an order using an explainable weighted score (see docs/BLUEPRINT.md §9):
 *
 *   score = w_distance   · distanceScore    (agent proximity to pickup)
 *         + w_zone       · zoneScore        (same home zone as pickup)
 *         + w_workload   · workloadScore     (free capacity + light committed route)
 *         + w_direction  · directionScore    (new leg aligned with current route)
 *         + w_reliability· reliabilityScore  (agent rating / fairness)
 *
 * where higher is better. The DB access + transactional claim live in the route
 * handler / `assignAgent`; this module only ranks candidates.
 */

export type Vec2 = { x: number; y: number };

export type AgentCandidate = {
  agentId: string;
  location: LatLng | null; // current GPS, when known
  homeZoneId: string | null;
  activeOrders: number;
  maxActiveOrders: number;
  committedRouteKm?: number; // total distance already committed across active orders
  heading?: Vec2 | null; // aggregate unit direction of current orders (planar)
  rating?: number; // 0..5 reliability (defaults to 5)
};

export type AssignmentContext = {
  pickup: LatLng | null;
  drop?: LatLng | null; // for direction alignment
  pickupZoneId: string;
};

export type AssignmentWeights = {
  distance: number;
  zone: number;
  workload: number;
  direction: number;
  reliability: number;
};

export const DEFAULT_ASSIGNMENT_WEIGHTS: AssignmentWeights = {
  distance: 0.35,
  zone: 0.2,
  workload: 0.2,
  direction: 0.15,
  reliability: 0.1,
};

// Reference distance (km) at which a committed route halves the route score.
const ROUTE_REF_KM = 25;

export type ScoredAgent = {
  agentId: string;
  score: number; // 0..1, higher = better
  distanceKm: number | null;
  sameZone: boolean;
  loadFactor: number; // 0..1 (1 = at capacity)
  committedRouteKm: number;
  directionScore: number; // 0..1 (1 = perfectly aligned, 0.5 = unknown)
  rating: number;
  reason: string;
};

const round4 = (n: number) => Math.round((n + Number.EPSILON) * 1e4) / 1e4;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** An agent can take another order only if below its active-order capacity. */
export function isAvailable(agent: AgentCandidate): boolean {
  return agent.activeOrders < agent.maxActiveOrders;
}

/**
 * Planar unit heading from `from` to `to` (equirectangular approximation, good
 * enough for city-scale alignment). Returns null for a zero-length leg.
 */
export function directionVector(from: LatLng, to: LatLng): Vec2 | null {
  const midLat = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  const x = (to.lng - from.lng) * Math.cos(midLat);
  const y = to.lat - from.lat;
  const mag = Math.hypot(x, y);
  if (mag === 0) return null;
  return { x: x / mag, y: y / mag };
}

export function scoreAgent(
  agent: AgentCandidate,
  ctx: AssignmentContext,
  weights: AssignmentWeights = DEFAULT_ASSIGNMENT_WEIGHTS,
): ScoredAgent {
  const sameZone =
    agent.homeZoneId !== null && agent.homeZoneId === ctx.pickupZoneId;

  const distanceKm =
    agent.location && ctx.pickup
      ? haversineKm(agent.location, ctx.pickup)
      : null;

  // Nearer is better; decays smoothly with distance. Unknown distance → 0 so
  // the zone/load terms decide.
  const distanceScore = distanceKm === null ? 0 : 1 / (1 + distanceKm);

  // Workload = free capacity (60%) + how little route is already committed (40%).
  const loadFactor =
    agent.maxActiveOrders > 0 ? agent.activeOrders / agent.maxActiveOrders : 1;
  const capacityScore = 1 - loadFactor;
  const committedRouteKm = Math.max(0, agent.committedRouteKm ?? 0);
  const routeScore = 1 / (1 + committedRouteKm / ROUTE_REF_KM);
  const workloadScore = 0.6 * capacityScore + 0.4 * routeScore;

  const zoneScore = sameZone ? 1 : 0;

  // Direction alignment: cosine of the new leg vs the agent's current heading,
  // mapped to 0..1. Neutral (0.5) when either heading is unknown.
  const newLeg =
    ctx.pickup && ctx.drop ? directionVector(ctx.pickup, ctx.drop) : null;
  const heading = agent.heading ?? null;
  const directionScore =
    newLeg && heading
      ? (newLeg.x * heading.x + newLeg.y * heading.y + 1) / 2
      : 0.5;

  const rating = agent.rating ?? 5;
  const reliabilityScore = Math.min(1, Math.max(0, rating / 5));

  const score =
    weights.distance * distanceScore +
    weights.zone * zoneScore +
    weights.workload * workloadScore +
    weights.direction * directionScore +
    weights.reliability * reliabilityScore;

  const parts: string[] = [];
  if (distanceKm !== null) parts.push(`${round2(distanceKm)} km away`);
  parts.push(sameZone ? "same zone" : "different zone");
  parts.push(`load ${Math.round(loadFactor * 100)}%`);
  if (committedRouteKm > 0) parts.push(`${round2(committedRouteKm)} km committed`);
  if (newLeg && heading) {
    parts.push(
      directionScore >= 0.6
        ? "route aligned"
        : directionScore <= 0.4
          ? "route detour"
          : "route neutral",
    );
  }
  parts.push(`rating ${round2(rating)}`);

  return {
    agentId: agent.agentId,
    score: round4(score),
    distanceKm: distanceKm === null ? null : round2(distanceKm),
    sameZone,
    loadFactor: round2(loadFactor),
    committedRouteKm: round2(committedRouteKm),
    directionScore: round2(directionScore),
    rating: round2(rating),
    reason: parts.join(", "),
  };
}

/**
 * Rank all available candidates and return the best plus the full ranking
 * (useful for showing the admin *why* an agent was chosen). Ties break
 * deterministically by agentId.
 */
export function selectAgent(
  candidates: AgentCandidate[],
  ctx: AssignmentContext,
  weights: AssignmentWeights = DEFAULT_ASSIGNMENT_WEIGHTS,
): { best: ScoredAgent | null; ranked: ScoredAgent[] } {
  const ranked = candidates
    .filter(isAvailable)
    .map((a) => scoreAgent(a, ctx, weights))
    .sort((a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId));

  return { best: ranked[0] ?? null, ranked };
}
