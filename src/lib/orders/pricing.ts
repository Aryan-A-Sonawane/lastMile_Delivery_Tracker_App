import {
  computeCharge,
  type RateBreakdown,
} from "@/lib/domain/rate-engine";
import {
  resolveZoneIdByPincode,
  resolveZoneType,
  type AreaMapping,
} from "@/lib/domain/zones";
import {
  selectActiveCodConfig,
  selectActiveRateCard,
  type Versioned,
} from "@/lib/domain/pricing-config";
import type { OrderType, PaymentType, ZoneType } from "@/lib/domain/types";

/**
 * Orchestrates a full quote (pure): pincode → zone detection, INTRA/INTER
 * resolution, active rate-card + COD selection, then the rate engine. All
 * configuration is passed in (loaded from the DB by the caller), so this stays
 * unit-testable with no I/O. See docs/BLUEPRINT.md §7–§8.
 */

export type QuoteRequest = {
  pickupPincode: string;
  dropPincode: string;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  actualWeightKg: number;
  orderType: OrderType;
  paymentType: PaymentType;
};

export type QuoteRateCard = Versioned & {
  id: string;
  orderType: OrderType;
  scope: ZoneType;
  baseRate: number;
  perKgRate: number;
  minChargeableWeight: number;
};

export type QuoteCodConfig = Versioned & {
  orderType: OrderType;
  mode: "FLAT" | "PERCENT";
  amount: number;
};

export type QuoteConfig = {
  areas: AreaMapping[];
  rateCards: QuoteRateCard[];
  codConfigs: QuoteCodConfig[];
  volumetricDivisor: number;
  currency: string;
  at?: Date; // pricing instant; defaults to now
};

export type QuoteResult = {
  pickupZoneId: string;
  dropZoneId: string;
  zoneType: ZoneType;
  breakdown: RateBreakdown;
};

/** Thrown for un-serviceable pincodes or missing pricing config (HTTP 422). */
export class QuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuoteError";
  }
}

export function resolveQuote(
  config: QuoteConfig,
  req: QuoteRequest,
): QuoteResult {
  const at = config.at ?? new Date();

  const pickupZoneId = resolveZoneIdByPincode(req.pickupPincode, config.areas);
  if (!pickupZoneId) {
    throw new QuoteError(`Pickup pincode ${req.pickupPincode} is not serviceable`);
  }
  const dropZoneId = resolveZoneIdByPincode(req.dropPincode, config.areas);
  if (!dropZoneId) {
    throw new QuoteError(`Drop pincode ${req.dropPincode} is not serviceable`);
  }

  const zoneType = resolveZoneType(pickupZoneId, dropZoneId);

  const rateCard = selectActiveRateCard(
    config.rateCards,
    req.orderType,
    zoneType,
    at,
  );
  if (!rateCard) {
    throw new QuoteError(
      `No active rate card configured for ${req.orderType} ${zoneType}-zone`,
    );
  }

  const cod =
    req.paymentType === "COD"
      ? selectActiveCodConfig(config.codConfigs, req.orderType, at)
      : null;
  if (req.paymentType === "COD" && !cod) {
    throw new QuoteError(
      `No active COD surcharge configured for ${req.orderType}`,
    );
  }

  const breakdown = computeCharge(
    {
      lengthCm: req.lengthCm,
      breadthCm: req.breadthCm,
      heightCm: req.heightCm,
      actualWeightKg: req.actualWeightKg,
      orderType: req.orderType,
      paymentType: req.paymentType,
      pickupZoneId,
      dropZoneId,
    },
    {
      volumetricDivisor: config.volumetricDivisor,
      currency: config.currency,
      rateCard: {
        id: rateCard.id,
        baseRate: rateCard.baseRate,
        perKgRate: rateCard.perKgRate,
        minChargeableWeight: rateCard.minChargeableWeight,
      },
      cod: cod ? { mode: cod.mode, amount: cod.amount } : null,
    },
  );

  return { pickupZoneId, dropZoneId, zoneType, breakdown };
}
