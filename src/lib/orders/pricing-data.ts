import { prisma } from "@/lib/prisma";
import {
  getCurrency,
  getSettingsMap,
  getVolumetricDivisor,
} from "@/lib/config/settings";
import type { QuoteConfig } from "./pricing";

/**
 * Loads all pricing configuration from the database into the pure
 * {@link QuoteConfig} shape (converting Decimal → number at the boundary).
 * Shared by the quote endpoint and order creation.
 */
export async function loadQuoteConfig(): Promise<QuoteConfig> {
  const [areas, rateCards, codConfigs, settingsMap] = await Promise.all([
    prisma.area.findMany({ select: { pincode: true, zoneId: true } }),
    prisma.rateCard.findMany(),
    prisma.codConfig.findMany(),
    getSettingsMap(),
  ]);

  return {
    areas,
    rateCards: rateCards.map((r) => ({
      id: r.id,
      orderType: r.orderType,
      scope: r.scope,
      baseRate: r.baseRate.toNumber(),
      perKgRate: r.perKgRate.toNumber(),
      minChargeableWeight: r.minChargeableWeight.toNumber(),
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      isActive: r.isActive,
    })),
    codConfigs: codConfigs.map((c) => ({
      orderType: c.orderType,
      mode: c.mode,
      amount: c.amount.toNumber(),
      effectiveFrom: c.effectiveFrom,
      effectiveTo: c.effectiveTo,
      isActive: c.isActive,
    })),
    volumetricDivisor: getVolumetricDivisor(settingsMap),
    currency: getCurrency(settingsMap),
  };
}
