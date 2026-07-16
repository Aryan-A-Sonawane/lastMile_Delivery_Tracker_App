-- Collapse pricing config to a single entry per key (order snapshots keep old
-- orders intact — there is no FK from orders to these tables). Keep the most
-- relevant row (active first, then most recent) and drop duplicates before
-- adding the uniqueness the schema now guarantees.

-- COD: one row per orderType
DELETE FROM "cod_configs"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "orderType"
      ORDER BY "isActive" DESC, "effectiveFrom" DESC, "createdAt" DESC
    ) AS rn
    FROM "cod_configs"
  ) t WHERE t.rn > 1
);

-- Rate cards: one row per (orderType, scope)
DELETE FROM "rate_cards"
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "orderType", "scope"
      ORDER BY "isActive" DESC, "effectiveFrom" DESC, "createdAt" DESC
    ) AS rn
    FROM "rate_cards"
  ) t WHERE t.rn > 1
);

CREATE UNIQUE INDEX "cod_configs_orderType_key" ON "cod_configs"("orderType");
CREATE UNIQUE INDEX "rate_cards_orderType_scope_key" ON "rate_cards"("orderType", "scope");
