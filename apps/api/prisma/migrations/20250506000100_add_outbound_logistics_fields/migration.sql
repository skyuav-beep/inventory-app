-- AlterTable
ALTER TABLE "outbounds"
  ADD COLUMN     "orderDate" TIMESTAMP(3),
  ADD COLUMN     "ordererId" TEXT,
  ADD COLUMN     "ordererName" TEXT,
  ADD COLUMN     "recipientName" TEXT,
  ADD COLUMN     "recipientPhone" TEXT,
  ADD COLUMN     "recipientAddress" TEXT,
  ADD COLUMN     "recipientPostalCode" TEXT,
  ADD COLUMN     "customsNumber" TEXT,
  ADD COLUMN     "invoiceNumber" TEXT;
