-- CreateEnum
CREATE TYPE "ClawbackReason" AS ENUM ('NO_SUPPLY_START', 'EARLY_TERMINATION', 'FRAUDULENT_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ClawbackStatus" AS ENUM ('AT_RISK', 'CONFIRMED', 'OFFSET', 'INVOICED', 'SETTLED', 'RELEASED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PriceUnitType" ADD VALUE 'TIERED_BY_USAGE';
ALTER TYPE "PriceUnitType" ADD VALUE 'MARKUP_ON_PAYOUT';

-- AlterTable
ALTER TABLE "contract_pricing_snapshots" ADD COLUMN     "actualUsageKwh" DECIMAL(12,2),
ADD COLUMN     "agencyTierId" TEXT,
ADD COLUMN     "deductionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedUsageKwh" DECIMAL(12,2),
ADD COLUMN     "hqTierId" TEXT,
ADD COLUMN     "seasonalCoefficient" DECIMAL(9,6),
ADD COLUMN     "usageMonth" INTEGER;

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "actualUsageKwh" DECIMAL(12,2),
ADD COLUMN     "estimatedUsageKwh" DECIMAL(12,2),
ADD COLUMN     "hasStatement" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isMatchingConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seasonalCoefficient" DECIMAL(9,6),
ADD COLUMN     "usageMonth" INTEGER;

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" TEXT NOT NULL,
    "pricingRuleId" TEXT NOT NULL,
    "minValue" DECIMAL(14,2) NOT NULL,
    "maxValue" DECIMAL(14,2),
    "amount" DECIMAL(18,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasonal_coefficients" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT,
    "productId" TEXT,
    "month" INTEGER NOT NULL,
    "coefficient" DECIMAL(9,6) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seasonal_coefficients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clawbacks" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "agencyId" TEXT,
    "reason" "ClawbackReason" NOT NULL,
    "status" "ClawbackStatus" NOT NULL DEFAULT 'AT_RISK',
    "hqAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "agencyAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "riskUntil" DATE,
    "refundDueOn" DATE,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clawbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_tiers_pricingRuleId_minValue_idx" ON "pricing_tiers"("pricingRuleId", "minValue");

-- CreateIndex
CREATE INDEX "seasonal_coefficients_organizationId_month_effectiveFrom_idx" ON "seasonal_coefficients"("organizationId", "month", "effectiveFrom");

-- CreateIndex
CREATE INDEX "clawbacks_organizationId_status_idx" ON "clawbacks"("organizationId", "status");

-- CreateIndex
CREATE INDEX "clawbacks_organizationId_riskUntil_idx" ON "clawbacks"("organizationId", "riskUntil");

-- CreateIndex
CREATE UNIQUE INDEX "clawbacks_contractId_reason_key" ON "clawbacks"("contractId", "reason");

-- AddForeignKey
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_pricingRuleId_fkey" FOREIGN KEY ("pricingRuleId") REFERENCES "pricing_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_coefficients" ADD CONSTRAINT "seasonal_coefficients_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_coefficients" ADD CONSTRAINT "seasonal_coefficients_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clawbacks" ADD CONSTRAINT "clawbacks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clawbacks" ADD CONSTRAINT "clawbacks_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clawbacks" ADD CONSTRAINT "clawbacks_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
