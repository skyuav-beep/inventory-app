-- Add retry scheduling columns for deferred alerts
ALTER TABLE "alerts"
  ADD COLUMN "retryAt" TIMESTAMP(3),
  ADD COLUMN "retryReason" TEXT,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "alerts_retryAt_idx" ON "alerts"("retryAt");
