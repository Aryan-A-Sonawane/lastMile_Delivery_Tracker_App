import { describe, it, expect } from "vitest";
import {
  canTransition,
  assertTransition,
  allowedNextStatuses,
  isTerminal,
  InvalidTransitionError,
} from "../status-machine";

describe("status-machine", () => {
  it("allows the normal agent flow", () => {
    expect(canTransition("ASSIGNED", "PICKED_UP", "AGENT")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "DELIVERED", "AGENT")).toBe(true);
    expect(canTransition("OUT_FOR_DELIVERY", "FAILED", "AGENT")).toBe(true);
  });

  it("blocks skipping states", () => {
    expect(canTransition("ASSIGNED", "DELIVERED", "AGENT")).toBe(false);
    expect(canTransition("PICKED_UP", "DELIVERED", "AGENT")).toBe(false);
  });

  it("restricts transitions by role", () => {
    expect(canTransition("CREATED", "ASSIGNED", "CUSTOMER")).toBe(false);
    expect(canTransition("FAILED", "RESCHEDULED", "CUSTOMER")).toBe(true);
  });

  it("lets an admin override to any status", () => {
    expect(canTransition("OUT_FOR_DELIVERY", "CREATED", "ADMIN")).toBe(true);
    expect(canTransition("DELIVERED", "IN_TRANSIT", "ADMIN")).toBe(true);
  });

  it("treats a status as never transitioning to itself", () => {
    expect(canTransition("ASSIGNED", "ASSIGNED", "ADMIN")).toBe(false);
  });

  it("marks DELIVERED as terminal", () => {
    expect(isTerminal("DELIVERED")).toBe(true);
    expect(isTerminal("ASSIGNED")).toBe(false);
  });

  it("lists allowed next statuses for a role", () => {
    expect(allowedNextStatuses("OUT_FOR_DELIVERY", "AGENT")).toEqual([
      "DELIVERED",
      "FAILED",
    ]);
    expect(allowedNextStatuses("OUT_FOR_DELIVERY", "CUSTOMER")).toEqual([]);
  });

  it("throws on an illegal transition", () => {
    expect(() => assertTransition("ASSIGNED", "DELIVERED", "AGENT")).toThrow(
      InvalidTransitionError,
    );
  });
});
