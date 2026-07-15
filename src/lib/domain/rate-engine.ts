import type { OrderType, PaymentType, ZoneType } from "./types";
import { resolveZoneType } from "./zones";

/**
 * Rate calculation engine (pure — no DB, no I/O).
 *
 * Formula (see docs/BLUEPRINT.md §7.2):
 *   volumetricWeight = (L × B × H) / volumetricDivisor          // divisor from Setting, default 5000
 *   billableWeight   = max(actualWeight, volumetricWeight, minChargeableWeight)
 *   zoneType         = pickupZone === dropZone ? INTRA : INTER
 *   weightCharge     = perKgRate × billableWeight
 *   baseCharge       = baseRate + weightCharge
 *   codSurcharge     = COD ? (FLAT: amount | PERCENT: baseCharge × amount / 100) : 0
 *   total            = baseCharge + codSurcharge
 *
 * The caller selects the correct rate card for (orderType, zoneType) and passes
 * it in; this function performs no lookups so it is trivially testable.
 */

export type RateInput = {
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  actualWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
  pickupZoneId: string;
  dropZoneId: string;
};

export type RateCardConfig = {
  id: string;
  baseRate: number; // flat handling charge
  perKgRate: number; // charge per billable kg
  minChargeableWeight: number; // floor on billable weight (kg)
};

export type CodSurchargeConfig = {
  mode: "FLAT" | "PERCENT";
  amount: number; // flat currency amount, or percent of baseCharge
};

export type RateConfig = {
  volumetricDivisor: number; // from Setting; default 5000
  currency: string; // e.g. "INR"
  rateCard: RateCardConfig; // pre-selected for (orderType, zoneType)
  cod?: CodSurchargeConfig | null; // required when paymentType === "COD"
};

export type RateBreakdown = {
  volumetricWeightKg: number;
  actualWeightKg: number;
  billableWeightKg: number;
  zoneType: ZoneType;
  baseRate: number;
  perKgRate: number;
  weightCharge: number;
  baseCharge: number;
  codSurcharge: number;
  total: number;
  currency: string;
  rateCardId: string;
  volumetricDivisor: number;
  computedAt: string;
};

/** Thrown for invalid inputs or missing configuration (maps to HTTP 422). */
export class RateEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateEngineError";
  }
}

// Money is rounded to 2 dp, weights to 3 dp. Adding EPSILON avoids binary
// float artefacts (e.g. 1.005 → 1.01, not 1.00).
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

export function computeVolumetricWeight(
  lengthCm: number,
  breadthCm: number,
  heightCm: number,
  volumetricDivisor: number,
): number {
  if (volumetricDivisor <= 0) {
    throw new RateEngineError("volumetricDivisor must be greater than 0");
  }
  return round3((lengthCm * breadthCm * heightCm) / volumetricDivisor);
}

function assertPositive(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RateEngineError(`${label} must be a positive number`);
  }
}

export function computeCharge(
  input: RateInput,
  config: RateConfig,
): RateBreakdown {
  assertPositive(input.lengthCm, "lengthCm");
  assertPositive(input.breadthCm, "breadthCm");
  assertPositive(input.heightCm, "heightCm");
  assertPositive(input.actualWeightKg, "actualWeightKg");

  const { rateCard, cod, volumetricDivisor, currency } = config;
  if (rateCard.baseRate < 0 || rateCard.perKgRate < 0) {
    throw new RateEngineError("rate card values must be non-negative");
  }

  const volumetricWeightKg = computeVolumetricWeight(
    input.lengthCm,
    input.breadthCm,
    input.heightCm,
    volumetricDivisor,
  );

  const billableWeightKg = round3(
    Math.max(
      input.actualWeightKg,
      volumetricWeightKg,
      rateCard.minChargeableWeight,
    ),
  );

  const zoneType = resolveZoneType(input.pickupZoneId, input.dropZoneId);
  const weightCharge = round2(rateCard.perKgRate * billableWeightKg);
  const baseCharge = round2(rateCard.baseRate + weightCharge);

  let codSurcharge = 0;
  if (input.paymentType === "COD") {
    if (!cod) {
      throw new RateEngineError(
        "COD surcharge configuration is required for COD orders",
      );
    }
    codSurcharge =
      cod.mode === "FLAT"
        ? round2(cod.amount)
        : round2((baseCharge * cod.amount) / 100);
  }

  const total = round2(baseCharge + codSurcharge);

  return {
    volumetricWeightKg,
    actualWeightKg: input.actualWeightKg,
    billableWeightKg,
    zoneType,
    baseRate: rateCard.baseRate,
    perKgRate: rateCard.perKgRate,
    weightCharge,
    baseCharge,
    codSurcharge,
    total,
    currency,
    rateCardId: rateCard.id,
    volumetricDivisor,
    computedAt: new Date().toISOString(),
  };
}
