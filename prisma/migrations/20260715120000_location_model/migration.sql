-- AlterTable
ALTER TABLE "areas" ADD COLUMN     "city" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "zones" ADD COLUMN     "radiusKm" DECIMAL(6,2);

-- CreateTable
CREATE TABLE "pincode_refs" (
    "pincode" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "pincode_refs_pkey" PRIMARY KEY ("pincode")
);

-- CreateIndex
CREATE INDEX "pincode_refs_state_city_idx" ON "pincode_refs"("state", "city");

