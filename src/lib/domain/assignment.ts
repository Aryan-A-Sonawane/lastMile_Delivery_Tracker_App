import type { LatLng } from "./types";
import { haversineKm } from "./zones";

/**
 * Auto-assignment engine (pure). Selects the best available delivery agent for
 * an order using an explainable weighted score (see docs/BLUEPRINT.md §9):
 *   score = w_distance · distanceScore + w_zone · zoneScore + w_load · loadScore
 * where higher is better. The DB access + transactional claim live in the route
 * handler; this module only ranks candidates.
 */

export type AgentCandidate = {
  agentId: string;
  location: LatLng | null; // current GPS, when known
  homeZoneId: string | null;
  activeOrders: number;
  maxActiveOrders: number;
};

export type AssignmentContext = {
  pickup: LatLng | null;
  pickupZoneId: string;
};

export type AssignmentWeights = {
  distance: number;
  zone: number;
  load: number;
};

export const DEFAULT_ASSIGNMENT_WEIGHTS: AssignmentWeights = {
  distance: 0.6,
  zone: 0.25,
  load: 0.15,
};

export type ScoredAgent = {
  agentId: string;
  score: number; // 0..1, higher = better
  distanceKm: number | null;
  sameZone: boolean;
  loadFactor: number; // 0..1 (1 = at capacity)
  reason: string;
};

const round4 = (n: number) => Math.round((n + Number.EPSILON) * 1e4) / 1e4;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** An agent can take another order only if below its active-order capacity. */
export function isAvailable(agent: AgentCandidate): boolean {
  return agent.activeOrders < agent.maxActiveOrders;
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
  const loadFactor =
    agent.maxActiveOrders > 0 ? agent.activeOrders / agent.maxActiveOrders : 1;
  const loadScore = 1 - loadFactor;
  const zoneScore = sameZone ? 1 : 0;

  const score =
    weights.distance * distanceScore +
    weights.zone * zoneScore +
    weights.load * loadScore;

  const parts: string[] = [];
  if (distanceKm !== null) parts.push(`${round2(distanceKm)} km away`);
  parts.push(sameZone ? "same zone" : "different zone");
  parts.push(`load ${Math.round(loadFactor * 100)}%`);

  return {
    agentId: agent.agentId,
    score: round4(score),
    distanceKm: distanceKm === null ? null : round2(distanceKm),
    sameZone,
    loadFactor: round2(loadFactor),
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
    .sort(
      (a, b) => b.score - a.score || a.agentId.localeCompare(b.agentId),
    );

  return { best: ranked[0] ?? null, ranked };
}
