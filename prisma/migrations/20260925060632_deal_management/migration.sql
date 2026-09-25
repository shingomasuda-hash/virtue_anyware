-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('APPOINTMENT', 'MEETING', 'PROPOSAL', 'CONTRACT', 'SCREENING', 'SURVEY', 'CONSTRUCTION', 'COMPLETED', 'LOST');

-- CreateEnum
CREATE TYPE "DealProductType" AS ENUM ('PV', 'BT', 'EQ', 'IH');

-- CreateEnum
CREATE TYPE "DealPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ProgressState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "LoanReviewState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PRE_APPROVED', 'MAIN_SCREENING', 'MAIN_APPROVED', 'REJECTED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "SiteSurveyState" AS ENUM ('NOT_STARTED', 'SCHEDULING', 'SCHEDULED', 'DONE', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "SubsidyState" AS ENUM ('NOT_REQUIRED', 'CHECKING', 'PLANNED', 'APPLIED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConstructionState" AS ENUM ('NOT_STARTED', 'ARRANGING', 'ARRANGED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "DealPaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "CompensationPaymentStatus" AS ENUM ('PENDING', 'PAID', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ManufacturerCategory" AS ENUM ('PV', 'BATTERY', 'EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DealActivityType" AS ENUM ('STATUS_CHANGE', 'MEMO', 'VISIT', 'CALL', 'PROGRESS_UPDATE');

-- AlterEnum
ALTER TYPE "PartnerKind" ADD VALUE 'FINANCE';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'INSTALLMENT';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "driveFolderUrl" TEXT,
ADD COLUMN     "registeredByName" TEXT;

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categories" "ManufacturerCategory"[],
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_models" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "manufacturerId" TEXT,
    "category" "ManufacturerCategory" NOT NULL DEFAULT 'BATTERY',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" DECIMAL(8,3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_statuses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stage" "DealStage" NOT NULL DEFAULT 'APPOINTMENT',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "isContracted" BOOLEAN NOT NULL DEFAULT false,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT 'slate',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agencyId" TEXT,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statusId" TEXT NOT NULL,
    "closerStaffId" TEXT,
    "appointerStaffId" TEXT,
    "productTypes" "DealProductType"[],
    "pvManufacturerId" TEXT,
    "pvCapacityKw" DECIMAL(8,3),
    "batteryManufacturerId" TEXT,
    "batteryModelId" TEXT,
    "batteryCapacityKwh" DECIMAL(8,3),
    "equipmentManufacturerId" TEXT,
    "metAt" DATE,
    "contractedAt" DATE,
    "salesPriceExclTax" DECIMAL(18,2),
    "paymentMethod" "PaymentMethod",
    "financeCompanyId" TEXT,
    "lostReason" TEXT,
    "nextActionAt" DATE,
    "priority" "DealPriority" NOT NULL DEFAULT 'MEDIUM',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_progresses" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "loanReview" "LoanReviewState" NOT NULL DEFAULT 'NOT_STARTED',
    "siteSurvey" "SiteSurveyState" NOT NULL DEFAULT 'NOT_STARTED',
    "siteSurveyAt" DATE,
    "subsidy" "SubsidyState" NOT NULL DEFAULT 'NOT_REQUIRED',
    "subsidyProgram" TEXT,
    "subsidyAppliedAt" DATE,
    "subsidyApprovedAt" DATE,
    "construction" "ConstructionState" NOT NULL DEFAULT 'NOT_STARTED',
    "constructionScheduledAt" DATE,
    "constructionCompletedAt" DATE,
    "completionCheck" "ProgressState" NOT NULL DEFAULT 'NOT_STARTED',
    "paymentDueAt" DATE,
    "paidAt" DATE,
    "paymentStatus" "DealPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "contractDocument" "ProgressState" NOT NULL DEFAULT 'NOT_STARTED',
    "importantMatters" "ProgressState" NOT NULL DEFAULT 'NOT_STARTED',
    "warranty" "ProgressState" NOT NULL DEFAULT 'NOT_STARTED',
    "sitePhotos" "ProgressState" NOT NULL DEFAULT 'NOT_STARTED',
    "gridConnection" "ProgressState" NOT NULL DEFAULT 'NOT_STARTED',
    "attention" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_compensations" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "equipmentCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "constructionCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "extendedWarrantyCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductionAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "salesCommissionRate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "agencyCommissionRate" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "commissionBase" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "salesCommission" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "agencyCommission" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "companyGrossProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "paymentDueAt" DATE,
    "paidAt" DATE,
    "paymentStatus" "CompensationPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_activities" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "DealActivityType" NOT NULL,
    "userId" TEXT,
    "fromStatusId" TEXT,
    "toStatusId" TEXT,
    "memo" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_organizationId_code_key" ON "manufacturers"("organizationId", "code");

-- CreateIndex
CREATE INDEX "equipment_models_organizationId_category_idx" ON "equipment_models"("organizationId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_models_organizationId_code_key" ON "equipment_models"("organizationId", "code");

-- CreateIndex
CREATE INDEX "deal_statuses_organizationId_sortOrder_idx" ON "deal_statuses"("organizationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "deal_statuses_organizationId_code_key" ON "deal_statuses"("organizationId", "code");

-- CreateIndex
CREATE INDEX "deals_organizationId_agencyId_contractedAt_idx" ON "deals"("organizationId", "agencyId", "contractedAt");

-- CreateIndex
CREATE INDEX "deals_organizationId_statusId_idx" ON "deals"("organizationId", "statusId");

-- CreateIndex
CREATE INDEX "deals_organizationId_nextActionAt_idx" ON "deals"("organizationId", "nextActionAt");

-- CreateIndex
CREATE INDEX "deals_customerId_idx" ON "deals"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "deals_organizationId_code_key" ON "deals"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "deal_progresses_dealId_key" ON "deal_progresses"("dealId");

-- CreateIndex
CREATE INDEX "deal_progresses_paymentStatus_paymentDueAt_idx" ON "deal_progresses"("paymentStatus", "paymentDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "deal_compensations_dealId_key" ON "deal_compensations"("dealId");

-- CreateIndex
CREATE INDEX "deal_compensations_paymentStatus_paymentDueAt_idx" ON "deal_compensations"("paymentStatus", "paymentDueAt");

-- CreateIndex
CREATE INDEX "deal_activities_dealId_occurredAt_idx" ON "deal_activities"("dealId", "occurredAt");

-- AddForeignKey
ALTER TABLE "manufacturers" ADD CONSTRAINT "manufacturers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_models" ADD CONSTRAINT "equipment_models_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_statuses" ADD CONSTRAINT "deal_statuses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "deal_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_closerStaffId_fkey" FOREIGN KEY ("closerStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_appointerStaffId_fkey" FOREIGN KEY ("appointerStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_pvManufacturerId_fkey" FOREIGN KEY ("pvManufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_batteryManufacturerId_fkey" FOREIGN KEY ("batteryManufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_equipmentManufacturerId_fkey" FOREIGN KEY ("equipmentManufacturerId") REFERENCES "manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_batteryModelId_fkey" FOREIGN KEY ("batteryModelId") REFERENCES "equipment_models"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_financeCompanyId_fkey" FOREIGN KEY ("financeCompanyId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_progresses" ADD CONSTRAINT "deal_progresses_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_compensations" ADD CONSTRAINT "deal_compensations_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_activities" ADD CONSTRAINT "deal_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
