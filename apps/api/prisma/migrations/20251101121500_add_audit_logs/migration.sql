-- Create audit_logs table and enum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'login', 'logout');

CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT,
  "resource" "Resource" NOT NULL,
  "action" "AuditAction" NOT NULL,
  "entityId" TEXT,
  "payloadJson" JSONB,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

CREATE INDEX "audit_logs_resource_action_createdAt_idx" ON "audit_logs"("resource", "action", "createdAt");
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");
