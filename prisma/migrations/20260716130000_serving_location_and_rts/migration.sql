-- Agent serving location (fixed, agent-editable center for distance scoring)
ALTER TABLE "agent_profiles" ADD COLUMN "serviceLat" DOUBLE PRECISION;
ALTER TABLE "agent_profiles" ADD COLUMN "serviceLng" DOUBLE PRECISION;
ALTER TABLE "agent_profiles" ADD COLUMN "serviceAddress" TEXT;

-- Seed serving location from any known live location so existing agents remain scorable.
UPDATE "agent_profiles"
SET "serviceLat" = "currentLat", "serviceLng" = "currentLng"
WHERE "serviceLat" IS NULL AND "currentLat" IS NOT NULL AND "currentLng" IS NOT NULL;

-- Terminal status for a shipment returned after exhausting delivery attempts.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'RETURN_TO_SENDER';
