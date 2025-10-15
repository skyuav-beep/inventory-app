-- AlterTable
ALTER TABLE "products" ADD COLUMN     "specification" TEXT,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'EA';
