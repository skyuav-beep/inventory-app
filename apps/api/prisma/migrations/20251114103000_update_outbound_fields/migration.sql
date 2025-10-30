-- AlterTable
ALTER TABLE "outbounds"
  RENAME COLUMN "note" TO "memo";

ALTER TABLE "outbounds"
  DROP COLUMN     "orderDate",
  DROP COLUMN     "ordererId",
  DROP COLUMN     "customsNumber",
  ADD COLUMN      "freightType" TEXT,
  ADD COLUMN      "paymentCondition" TEXT,
  ADD COLUMN      "specialNote" TEXT;

ALTER TABLE "outbounds"
  ALTER COLUMN "dateOut" SET DEFAULT CURRENT_TIMESTAMP;
