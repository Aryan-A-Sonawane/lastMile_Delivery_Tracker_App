import { describe, it, expect } from "vitest";
import {
  computeCharge,
  computeVolumetricWeight,
  RateEngineError,
  type RateConfig,
  type RateInput,
} from "../rate-engine";

// A reusable base config; individual cases override what they need.
const baseConfig: RateConfig = {
  volumetricDivisor: 5000,
  currency: "INR",
  rateCard: { id: "rc_test", baseRate: 50, perKgRate: 20, minChargeableWeight: 0.5 },
  cod: null,
};

const baseInput: RateInput = {
  lengthCm: 40,
  breadthCm: 30,
  heightCm: 20, // volumetric = 24000 / 5000 = 4.8 kg
  actualWeightKg: 3,
  orderType: "B2C",
  paymentType: "PREPAID",
  pickupZoneId: "Z1",
  dropZoneId: "Z1",
};

describe("computeVolumetricWeight", () => {
  it("applies the L×B×H ÷ divisor formula", () => {
    expect(computeVolumetricWeight(40, 30, 20, 5000)).toBe(4.8);
    expect(computeVolumetricWeight(10, 10, 10, 5000)).toBe(0.2);
  });

  it("rejects a non-positive divisor", () => {
    expect(() => computeVolumetricWeight(10, 10, 10, 0)).toThrow(RateEngineError);
  });
});

describe("computeCharge — billable weight selection", () => {
  it("bills on volumetric weight when it exceeds actual", () => {
    const r = computeCharge(baseInput, baseConfig); // vol 4.8 > actual 3
    expect(r.volumetricWeightKg).toBe(4.8);
    expect(r.billableWeightKg).toBe(4.8);
    expect(r.weightCharge).toBe(96); // 20 × 4.8
    expect(r.baseCharge).toBe(146); // 50 + 96
    expect(r.total).toBe(146); // prepaid
  });

  it("bills on actual weight when it exceeds volumetric", () => {
    const r = computeCharge({ ...baseInput, actualWeightKg: 10 }, baseConfig);
    expect(r.billableWeightKg).toBe(10);
    expect(r.baseCharge).toBe(250); // 50 + 20×10
  });

  it("floors billable weight at minChargeableWeight", () => {
    const r = computeCharge(
      { ...baseInput, lengthCm: 10, breadthCm: 10, heightCm: 10, actualWeightKg: 0.1 },
      baseConfig, // vol 0.2, actual 0.1, min 0.5 → billable 0.5
    );
    expect(r.billableWeightKg).toBe(0.5);
    expect(r.baseCharge).toBe(60); // 50 + 20×0.5
  });
});

describe("computeCharge — zone type", () => {
  it("is INTRA when pickup and drop zones match", () => {
    expect(computeCharge(baseInput, baseConfig).zoneType).toBe("INTRA");
  });

  it("is INTER when pickup and drop zones differ", () => {
    const r = computeCharge({ ...baseInput, dropZoneId: "Z2" }, baseConfig);
    expect(r.zoneType).toBe("INTER");
  });
});

describe("computeCharge — COD surcharge", () => {
  it("adds a flat COD surcharge", () => {
    const r = computeCharge(
      { ...baseInput, paymentType: "COD" },
      { ...baseConfig, cod: { mode: "FLAT", amount: 30 } },
    );
    expect(r.codSurcharge).toBe(30);
    expect(r.total).toBe(176); // 146 + 30
  });

  it("adds a percentage COD surcharge on the base charge", () => {
    const r = computeCharge(
      { ...baseInput, paymentType: "COD" },
      { ...baseConfig, cod: { mode: "PERCENT", amount: 10 } },
    );
    expect(r.codSurcharge).toBe(14.6); // 10% of 146
    expect(r.total).toBe(160.6);
  });

  it("adds no surcharge for prepaid orders", () => {
    const r = computeCharge(baseInput, { ...baseConfig, cod: { mode: "FLAT", amount: 30 } });
    expect(r.codSurcharge).toBe(0);
    expect(r.total).toBe(146);
  });

  it("throws when a COD order has no COD config", () => {
    expect(() =>
      computeCharge({ ...baseInput, paymentType: "COD" }, { ...baseConfig, cod: null }),
    ).toThrow(RateEngineError);
  });
});

describe("computeCharge — B2B vs B2C use the caller-selected rate card", () => {
  it("reflects whatever rate card the caller passes in", () => {
    const b2b = computeCharge(
      { ...baseInput, orderType: "B2B" },
      { ...baseConfig, rateCard: { id: "rc_b2b", baseRate: 100, perKgRate: 15, minChargeableWeight: 1 } },
    );
    expect(b2b.rateCardId).toBe("rc_b2b");
    expect(b2b.baseCharge).toBe(172); // 100 + 15×4.8
  });
});

describe("computeCharge — input validation", () => {
  it.each([
    ["lengthCm", { lengthCm: 0 }],
    ["breadthCm", { breadthCm: -1 }],
    ["heightCm", { heightCm: 0 }],
    ["actualWeightKg", { actualWeightKg: 0 }],
  ])("rejects non-positive %s", (_label, override) => {
    expect(() => computeCharge({ ...baseInput, ...override }, baseConfig)).toThrow(
      RateEngineError,
    );
  });
});
