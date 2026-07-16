import { describe, it, expect } from "vitest";
import {
  selectAgent,
  isAvailable,
  directionVector,
  type AgentCandidate,
  type AssignmentContext,
} from "../assignment";

const ctx: AssignmentContext = {
  pickup: { lat: 12.9716, lng: 77.5946 }, // Bengaluru city centre
  pickupZoneId: "Z1",
};

const near: AgentCandidate = {
  agentId: "near",
  location: { lat: 12.9726, lng: 77.5956 }, // ~150 m away
  homeZoneId: "Z1",
  activeOrders: 1,
  maxActiveOrders: 5,
};

const far: AgentCandidate = {
  agentId: "far",
  location: { lat: 13.05, lng: 77.7 }, // ~20 km away
  homeZoneId: "Z2",
  activeOrders: 0,
  maxActiveOrders: 5,
};

const full: AgentCandidate = {
  agentId: "full",
  location: { lat: 12.9717, lng: 77.5947 }, // essentially on top of pickup
  homeZoneId: "Z1",
  activeOrders: 5,
  maxActiveOrders: 5, // at capacity → unavailable
};

describe("assignment", () => {
  it("models availability by capacity", () => {
    expect(isAvailable(near)).toBe(true);
    expect(isAvailable(full)).toBe(false);
  });

  it("prefers the nearest available same-zone agent", () => {
    const { best, ranked } = selectAgent([far, near], ctx);
    expect(best?.agentId).toBe("near");
    expect(ranked.map((r) => r.agentId)).toEqual(["near", "far"]);
  });

  it("excludes agents at capacity even if they are closest", () => {
    const { best, ranked } = selectAgent([full, near, far], ctx);
    expect(best?.agentId).toBe("near");
    expect(ranked.some((r) => r.agentId === "full")).toBe(false);
  });

  it("returns null when no agent is available", () => {
    const { best } = selectAgent([full], ctx);
    expect(best).toBeNull();
  });

  it("produces an explainable reason", () => {
    const { best } = selectAgent([near], ctx);
    expect(best?.reason).toMatch(/km away/);
    expect(best?.reason).toMatch(/same zone/);
  });

  it("prefers the agent whose current route aligns with the new leg", () => {
    // New leg heads east (increasing longitude).
    const dirCtx: AssignmentContext = {
      pickup: { lat: 12.97, lng: 77.59 },
      drop: { lat: 12.97, lng: 77.69 },
      pickupZoneId: "Z1",
    };
    const base: Omit<AgentCandidate, "agentId" | "heading"> = {
      location: { lat: 12.97, lng: 77.59 },
      homeZoneId: "Z1",
      activeOrders: 1,
      maxActiveOrders: 5,
      committedRouteKm: 5,
      rating: 5,
    };
    const aligned: AgentCandidate = { ...base, agentId: "aligned", heading: { x: 1, y: 0 } };
    const detour: AgentCandidate = { ...base, agentId: "detour", heading: { x: -1, y: 0 } };

    const { best, ranked } = selectAgent([detour, aligned], dirCtx);
    expect(best?.agentId).toBe("aligned");
    expect(ranked[0].directionScore).toBeGreaterThan(ranked[1].directionScore);
  });

  it("penalises a heavier committed route in the workload term", () => {
    const light: AgentCandidate = { ...near, agentId: "light", committedRouteKm: 0 };
    const heavy: AgentCandidate = { ...near, agentId: "heavy", committedRouteKm: 80 };
    const { best } = selectAgent([heavy, light], ctx);
    expect(best?.agentId).toBe("light");
  });

  it("computes a unit direction vector (null for a zero leg)", () => {
    const v = directionVector({ lat: 0, lng: 0 }, { lat: 0, lng: 1 });
    expect(v).not.toBeNull();
    expect(Math.hypot(v!.x, v!.y)).toBeCloseTo(1, 5);
    expect(v!.x).toBeGreaterThan(0); // heading east
    expect(directionVector({ lat: 5, lng: 5 }, { lat: 5, lng: 5 })).toBeNull();
  });
});
