import { describe, it, expect } from "vitest";
import { resolveQuote, QuoteError, type QuoteConfig, type QuoteRequest } from "@/lib/orders/pricing";

const config: QuoteConfig = {
  areas: [
    { pincode: "560001", zoneId: "north" },
    { pincode: "560003", zoneId: "north" },
    { pincode: "560041", zoneId: "south" },
  ],
  rateCards: [
    { id: "b2c-intra", orderType: "B2C", scope: "INTRA", baseRate: 40, perKgRate: 15, minChargeableWeight: 0.5, effectiveFrom: new Date("2026-01-01"), effectiveTo: null, isActive: true },
    { id: "b2c-inter", orderType: "B2C", scope: "INTER", baseRate: 60, perKgRate: 25, minChargeableWeight: 0.5, effectiveFrom: new Date("2026-01-01"), effectiveTo: null, isActive: true },
  ],
  codConfigs: [
    { orderType: "B2C", mode: "FLAT", amount: 30, effectiveFrom: new Date("2026-01-01"), effectiveTo: null, isActive: true },
  ],
  volumetricDivisor: 5000,
  currency: "INR",
  at: new Date("2026-06-01"),
};

const req: QuoteRequest = {
  pickupPincode: "560001",
  dropPincode: "560003", // same zone → INTRA
  lengthCm: 40,
  breadthCm: 30,
  heightCm: 20, // vol = 4.8
  actualWeightKg: 3,
  orderType: "B2C",
  paymentType: "PREPAID",
};

describe("resolveQuote", () => {
  it("detects zones and prices an INTRA prepaid order", () => {
    const r = resolveQuote(config, req);
    expect(r.pickupZoneId).toBe("north");
    expect(r.dropZoneId).toBe("north");
    expect(r.zoneType).toBe("INTRA");
    expect(r.breakdown.rateCardId).toBe("b2c-intra");
    expect(r.breakdown.billableWeightKg).toBe(4.8);
    expect(r.breakdown.total).toBe(112); // 40 + 15×4.8
  });

  it("prices an INTER order across zones", () => {
    const r = resolveQuote(config, { ...req, dropPincode: "560041" });
    expect(r.zoneType).toBe("INTER");
    expect(r.breakdown.rateCardId).toBe("b2c-inter");
    expect(r.breakdown.total).toBe(180); // 60 + 25×4.8
  });

  it("adds the COD surcharge", () => {
    const r = resolveQuote(config, { ...req, paymentType: "COD" });
    expect(r.breakdown.codSurcharge).toBe(30);
    expect(r.breakdown.total).toBe(142); // 112 + 30
  });

  it("rejects an un-serviceable pickup pincode", () => {
    expect(() => resolveQuote(config, { ...req, pickupPincode: "999999" })).toThrow(QuoteError);
  });

  it("rejects an un-serviceable drop pincode", () => {
    expect(() => resolveQuote(config, { ...req, dropPincode: "999999" })).toThrow(QuoteError);
  });

  it("rejects when no rate card is configured for the combination", () => {
    expect(() => resolveQuote(config, { ...req, orderType: "B2B" })).toThrow(QuoteError);
  });

  it("rejects a COD order when no COD config exists", () => {
    const noCod: QuoteConfig = { ...config, codConfigs: [] };
    expect(() => resolveQuote(noCod, { ...req, paymentType: "COD" })).toThrow(QuoteError);
  });
});
