-- AlterTable
ALTER TABLE "import_batches" ADD COLUMN     "options" JSONB,
ADD COLUMN     "warningCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "import_rows" ADD COLUMN     "contractUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "customerUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "warnings" JSONB;
