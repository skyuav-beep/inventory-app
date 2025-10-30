ALTER TABLE "returns"
  ADD COLUMN "outboundId" TEXT,
  ADD CONSTRAINT "returns_outboundId_fkey" FOREIGN KEY ("outboundId") REFERENCES "outbounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "returns_outboundId_idx" ON "returns"("outboundId");
