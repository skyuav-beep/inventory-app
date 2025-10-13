-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'operator', 'viewer');

-- CreateEnum
CREATE TYPE "Resource" AS ENUM ('dashboard', 'products', 'inbounds', 'outbounds', 'returns', 'settings');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('normal', 'warn', 'low');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('pending', 'completed');

-- CreateEnum
CREATE TYPE "AlertLevel" AS ENUM ('info', 'warn', 'low', 'error');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('telegram', 'slack', 'email');

-- CreateEnum
CREATE TYPE "UploadType" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('queued', 'processing', 'completed', 'failed');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'operator',
    "passwordHash" TEXT NOT NULL,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resource" "Resource" NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT true,
    "write" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "safetyStock" INTEGER NOT NULL DEFAULT 0,
    "totalIn" INTEGER NOT NULL DEFAULT 0,
    "totalOut" INTEGER NOT NULL DEFAULT 0,
    "totalReturn" INTEGER NOT NULL DEFAULT 0,
    "remain" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'normal',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbounds" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "dateIn" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbounds" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "dateOut" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "dateReturn" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "level" "AlertLevel" NOT NULL DEFAULT 'warn',
    "channel" "Channel" NOT NULL DEFAULT 'telegram',
    "message" TEXT NOT NULL,
    "dedupKey" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT true,
    "telegramCooldownMin" INTEGER NOT NULL DEFAULT 60,
    "telegramQuietHours" TEXT NOT NULL DEFAULT '22-07',
    "telegramBotToken" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_targets" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "settingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_jobs" (
    "id" TEXT NOT NULL,
    "type" "UploadType" NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'queued',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "lastError" TEXT,

    CONSTRAINT "upload_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upload_job_items" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'queued',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_job_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_userId_resource_key" ON "permissions"("userId", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "products_code_idx" ON "products"("code");

-- CreateIndex
CREATE INDEX "inbounds_productId_dateIn_idx" ON "inbounds"("productId", "dateIn");

-- CreateIndex
CREATE INDEX "outbounds_productId_dateOut_idx" ON "outbounds"("productId", "dateOut");

-- CreateIndex
CREATE INDEX "returns_productId_dateReturn_idx" ON "returns"("productId", "dateReturn");

-- CreateIndex
CREATE INDEX "alerts_productId_sentAt_idx" ON "alerts"("productId", "sentAt");

-- CreateIndex
CREATE INDEX "alerts_dedupKey_idx" ON "alerts"("dedupKey");

-- CreateIndex
CREATE INDEX "telegram_targets_chatId_idx" ON "telegram_targets"("chatId");

-- CreateIndex
CREATE INDEX "upload_jobs_type_status_idx" ON "upload_jobs"("type", "status");

-- CreateIndex
CREATE INDEX "upload_jobs_createdAt_idx" ON "upload_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "upload_job_items_jobId_rowNo_idx" ON "upload_job_items"("jobId", "rowNo");

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbounds" ADD CONSTRAINT "inbounds_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbounds" ADD CONSTRAINT "outbounds_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_targets" ADD CONSTRAINT "telegram_targets_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "notification_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_jobs" ADD CONSTRAINT "upload_jobs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upload_job_items" ADD CONSTRAINT "upload_job_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "upload_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
