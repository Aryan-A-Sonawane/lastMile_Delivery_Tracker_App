import { describe, it, expect } from "vitest";
import { generateTrackingNumber } from "@/lib/orders/tracking";

describe("generateTrackingNumber", () => {
  it("produces the LM-<time>-<suffix> format", () => {
    const tn = generateTrackingNumber(new Date("2026-07-15T00:00:00Z"), () => 0.5);
    expect(tn).toMatch(/^LM-[0-9A-Z]+-[0-9A-Z]{4}$/);
  });

  it("varies with the random source", () => {
    const now = new Date("2026-07-15T00:00:00Z");
    const a = generateTrackingNumber(now, () => 0.1);
    const b = generateTrackingNumber(now, () => 0.9);
    expect(a).not.toBe(b);
  });

  it("pads short suffixes to 4 chars", () => {
    const tn = generateTrackingNumber(new Date("2026-07-15T00:00:00Z"), () => 0);
    expect(tn.endsWith("-0000")).toBe(true);
  });
});
