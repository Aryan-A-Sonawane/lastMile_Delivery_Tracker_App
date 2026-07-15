import type { OrderType, ZoneType } from "./types";

/**
 * Versioned pricing-config resolution (pure). Rate cards and COD configs are
 * versioned with effective dates + isActive so pricing can change without
 * corrupting historical orders. These helpers pick the config that applies at a
 * given instant. The DB access lives in the route handler; this module only
 * selects among already-loaded rows.
 */

export type Versioned = {
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
};

/** Is a versioned config in effect at instant `at`? (effectiveTo is exclusive.) */
export function isEffectiveAt(v: Versioned, at: Date): boolean {
  const t = at.getTime();
  return (
    v.isActive &&
    v.effectiveFrom.getTime() <= t &&
    (v.effectiveTo === null || v.effectiveTo.getTime() > t)
  );
}

/** Among effective items, the one with the latest effectiveFrom wins. */
export function selectActive<T extends Versioned>(
  items: T[],
  at: Date,
): T | null {
  const eligible = items.filter((i) => isEffectiveAt(i, at));
  if (eligible.length === 0) return null;
  return eligible.reduce((best, cur) =>
    cur.effectiveFrom.getTime() >= best.effectiveFrom.getTime() ? cur : best,
  );
}

export function selectActiveRateCard<
  T extends Versioned & { orderType: OrderType; scope: ZoneType },
>(cards: T[], orderType: OrderType, scope: ZoneType, at: Date = new Date()): T | null {
  return selectActive(
    cards.filter((c) => c.orderType === orderType && c.scope === scope),
    at,
  );
}

export function selectActiveCodConfig<
  T extends Versioned & { orderType: OrderType },
>(configs: T[], orderType: OrderType, at: Date = new Date()): T | null {
  return selectActive(
    configs.filter((c) => c.orderType === orderType),
    at,
  );
}
