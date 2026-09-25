-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "areaName" TEXT,
ADD COLUMN     "documentMailStatus" TEXT,
ADD COLUMN     "followUpStatus" TEXT,
ADD COLUMN     "matchedAt" DATE,
ADD COLUMN     "matchingMonth" INTEGER,
ADD COLUMN     "paymentMethodLabel" TEXT,
ADD COLUMN     "usageAmountYen" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "contactPersonName" TEXT,
ADD COLUMN     "mobilePhone" TEXT;
