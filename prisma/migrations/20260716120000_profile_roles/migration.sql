-- AlterTable: add capabilities array
ALTER TABLE "profiles" ADD COLUMN "roles" "Role"[] DEFAULT ARRAY['CUSTOMER']::"Role"[];

-- Backfill capabilities from the existing primary role.
UPDATE "profiles" SET "roles" = ARRAY["role"]::"Role"[];
