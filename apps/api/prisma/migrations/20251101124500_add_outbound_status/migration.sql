CREATE TYPE "OutboundStatus" AS ENUM ('shipped', 'in_transit', 'delivered', 'returned');

ALTER TABLE "outbounds"
  ADD COLUMN "status" "OutboundStatus" NOT NULL DEFAULT 'shipped';
