import { describe, it, expect } from "vitest";
import {
  isEffectiveAt,
  selectActive,
  selectActiveRateCard,
  selectActiveCodConfig,
} from "../pricing-config";

const d = (s: string) => new Date(s);

describe("isEffectiveAt", () => {
  const base = { effectiveFrom: d("2026-01-01"), effectiveTo: null, isActive: true };

  it("is true within an open-ended active window", () => {
    expect(isEffectiveAt(base, d("2026-06-01"))).toBe(true);
  });

  it("is false before effectiveFrom", () => {
    expect(isEffectiveAt(base, d("2025-12-31"))).toBe(false);
  });

  it("treats effectiveTo as exclusive", () => {
    const v = { ...base, effectiveTo: d("2026-06-01") };
    expect(isEffectiveAt(v, d("2026-05-31"))).toBe(true);
    expect(isEffectiveAt(v, d("2026-06-01"))).toBe(false);
  });

  it("is false when inactive", () => {
    expect(isEffectiveAt({ ...base, isActive: false }, d("2026-06-01"))).toBe(false);
  });
});

describe("selectActive", () => {
  it("picks the latest effectiveFrom among overlapping active versions", () => {
    const items = [
      { id: "old", effectiveFrom: d("2026-01-01"), effectiveTo: null, isActive: true },
      { id: "new", effectiveFrom: d("2026-03-01"), effectiveTo: null, isActive: true },
    ];
    expect(selectActive(items, d("2026-06-01"))?.id).toBe("new");
  });

  it("returns null when nothing is effective", () => {
    const items = [
      { id: "future", effectiveFrom: d("2027-01-01"), effectiveTo: null, isActive: true },
    ];
    expect(selectActive(items, d("2026-06-01"))).toBeNull();
  });
});

describe("selectActiveRateCard / selectActiveCodConfig", () => {
  const cards = [
    { id: "b2c-intra", orderType: "B2C" as const, scope: "INTRA" as const, effectiveFrom: d("2026-01-01"), effectiveTo: null, isActive: true },
    { id: "b2c-inter", orderType: "B2C" as const, scope: "INTER" as const, effectiveFrom: d("2026-01-01"), effectiveTo: null, isActive: true },
    { id: "b2b-intra", orderType: "B2B" as const, scope: "INTRA" as const, effectiveFrom: d("2026-01-01"), effectiveTo: null, isActive: true },
  ];

  it("selects by orderType + scope", () => {
    expect(selectActiveRateCard(cards, "B2C", "INTER", d("2026-06-01"))?.id).toBe("b2c-inter");
    expect(selectActiveRateCard(cards, "B2B", "INTRA", d("2026-06-01"))?.id).toBe("b2b-intra");
    expect(selectActiveRateCard(cards, "B2B", "INTER", d("2026-06-01"))).toBeNull();
  });

  it("selects COD config by orderType", () => {
    const cods = [
      { id: "cod-b2c", orderType: "B2C" as const, effectiveFrom: d("2026-01-01"), effectiveTo: null, isActive: true },
    ];
    expect(selectActiveCodConfig(cods, "B2C", d("2026-06-01"))?.id).toBe("cod-b2c");
    expect(selectActiveCodConfig(cods, "B2B", d("2026-06-01"))).toBeNull();
  });
});
