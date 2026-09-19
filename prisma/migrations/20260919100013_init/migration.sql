-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'AGENCY_ADMIN', 'AGENCY_STAFF');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('ELECTRICITY', 'GAS', 'SOLAR', 'BATTERY', 'SOLAR_BATTERY', 'WATER_SERVER', 'INTERNET', 'EV_CHARGER', 'REFORM', 'OTHER');

-- CreateEnum
CREATE TYPE "QuantityUnit" AS ENUM ('WATT', 'CONTRACT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "PriceUnitType" AS ENUM ('PER_WATT', 'PER_CONTRACT', 'PERCENT_OF_AMOUNT', 'FIXED');

-- CreateEnum
CREATE TYPE "PricingSide" AS ENUM ('HQ_RECEIVE', 'AGENCY_PAYOUT');

-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('TARGET', 'CALLED', 'CONNECTED', 'INTERESTED', 'APPOINTMENT', 'TOSSUP', 'MEETING', 'WON', 'LOST', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'COMMITTED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('PENDING', 'CREATED', 'UPDATED', 'SKIPPED_DUPLICATE', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportTargetEntity" AS ENUM ('CUSTOMER_CONTRACT', 'CUSTOMER', 'CONTRACT', 'EXPENSE', 'EVENT_METRIC');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CSV_IMPORT', 'CUSTOMER_CREATED', 'CUSTOMER_UPDATED', 'CONTRACT_CREATED', 'CONTRACT_UPDATED', 'STATUS_CHANGED', 'CALL', 'MEMO', 'APPOINTMENT', 'TOSSUP', 'MEETING', 'WON', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "UpsellActivityType" AS ENUM ('CALL', 'MEMO', 'STATUS_CHANGE', 'APPOINTMENT', 'MEETING');

-- CreateEnum
CREATE TYPE "TossupStatus" AS ENUM ('TOSSED', 'ACCEPTED', 'MEETING_SCHEDULED', 'MEETING_DONE', 'QUOTED', 'WON', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'RUNNING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'PART_TIME', 'CONTRACTOR', 'AGENCY_STAFF');

-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('HOURLY', 'DAILY', 'FIXED', 'COMMISSION');

-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('TOSSUP', 'VENDOR', 'SUPPLIER', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxCategory" AS ENUM ('TAXABLE_10', 'TAXABLE_8', 'TAX_FREE', 'NON_TAXABLE', 'EXEMPT');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'PENDING_PAYMENT', 'PAID');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('NOT_BILLED', 'BILLED', 'AWAITING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'PROCESSING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCESSING', 'PAID');

-- CreateEnum
CREATE TYPE "AllocationBasis" AS ENUM ('CONTRACT_COUNT', 'REVENUE', 'WORK_HOURS', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'CASH', 'CREDIT_CARD', 'E_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "RevenueSourceType" AS ENUM ('CONTRACT', 'TOSSUP', 'OTHER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'HQ_STAFF',
    "organizationId" TEXT,
    "agencyId" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "corporateName" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "postalCode" TEXT,
    "prefecture" TEXT,
    "city" TEXT,
    "address" TEXT,
    "building" TEXT,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "paymentTerms" TEXT,
    "paymentClosingDay" INTEGER,
    "paymentMonthOffset" INTEGER DEFAULT 1,
    "paymentDay" INTEGER,
    "bankName" TEXT,
    "bankBranch" TEXT,
    "bankAccountType" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountHolder" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_unit_prices" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "productId" TEXT,
    "unitType" "PriceUnitType" NOT NULL DEFAULT 'PER_WATT',
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_unit_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "quantityUnit" "QuantityUnit" NOT NULL DEFAULT 'CONTRACT',
    "isUpsell" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "productId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_statuses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActiveContract" BOOLEAN NOT NULL DEFAULT true,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "isDefect" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT 'slate',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_statuses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "funnelStage" "FunnelStage" NOT NULL DEFAULT 'TARGET',
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "color" TEXT NOT NULL DEFAULT 'slate',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "side" "PricingSide" NOT NULL,
    "agencyId" TEXT,
    "productId" TEXT,
    "supplierId" TEXT,
    "planId" TEXT,
    "unitType" "PriceUnitType" NOT NULL DEFAULT 'PER_WATT',
    "unitPrice" DECIMAL(12,4) NOT NULL,
    "rate" DECIMAL(9,6),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agencyId" TEXT,
    "externalCustomerId" TEXT,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "email" TEXT,
    "postalCode" TEXT,
    "prefecture" TEXT,
    "city" TEXT,
    "address" TEXT,
    "building" TEXT,
    "birthDate" DATE,
    "assignedUserId" TEXT,
    "sourceEventId" TEXT,
    "sourceBoothId" TEXT,
    "acquiredAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agencyId" TEXT,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "contractNumber" TEXT,
    "supplierId" TEXT,
    "planId" TEXT,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "contractWatt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "baseAmount" DECIMAL(18,2),
    "statusId" TEXT NOT NULL,
    "appliedAt" DATE,
    "contractedAt" DATE,
    "activatedAt" DATE,
    "cancelledAt" DATE,
    "cancelReason" TEXT,
    "contractedTime" TIMESTAMP(3),
    "eventId" TEXT,
    "boothId" TEXT,
    "staffId" TEXT,
    "campaign" TEXT,
    "notes" TEXT,
    "hqUnitPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "agencyUnitPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "hqRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "agencyPayout" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "hqGrossProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossMargin" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "pricedAt" TIMESTAMP(3),
    "createdByBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_pricing_snapshots" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "basisDate" DATE NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "hqUnitPrice" DECIMAL(12,4) NOT NULL,
    "agencyUnitPrice" DECIMAL(12,4) NOT NULL,
    "hqUnitType" "PriceUnitType" NOT NULL,
    "agencyUnitType" "PriceUnitType" NOT NULL,
    "hqRevenue" DECIMAL(18,2) NOT NULL,
    "agencyPayout" DECIMAL(18,2) NOT NULL,
    "hqGrossProfit" DECIMAL(18,2) NOT NULL,
    "grossMargin" DECIMAL(9,6) NOT NULL,
    "hqPricingRuleId" TEXT,
    "agencyPriceId" TEXT,
    "calcVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_pricing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_activities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contractId" TEXT,
    "upsellLeadId" TEXT,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "meta" JSONB,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_leads" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceContractId" TEXT,
    "statusId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "lastCalledAt" TIMESTAMP(3),
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_activities" (
    "id" TEXT NOT NULL,
    "upsellLeadId" TEXT NOT NULL,
    "type" "UpsellActivityType" NOT NULL,
    "calledAt" TIMESTAMP(3),
    "connected" BOOLEAN,
    "reaction" TEXT,
    "nextCallAt" TIMESTAMP(3),
    "memo" TEXT,
    "statusId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upsell_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kinds" "PartnerKind"[],
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tossups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "upsellLeadId" TEXT NOT NULL,
    "partnerId" TEXT,
    "productId" TEXT,
    "tossedAt" DATE NOT NULL,
    "partnerContactName" TEXT,
    "meetingScheduledAt" TIMESTAMP(3),
    "expectedRevenue" DECIMAL(18,2),
    "referralFee" DECIMAL(18,2),
    "status" "TossupStatus" NOT NULL DEFAULT 'TOSSED',
    "result" TEXT,
    "closedAt" DATE,
    "actualRevenue" DECIMAL(18,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tossups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operatorName" TEXT,
    "facilityType" TEXT,
    "postalCode" TEXT,
    "prefecture" TEXT,
    "city" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "floorAreaSqm" DECIMAL(12,2),
    "storeCount" INTEGER,
    "visitorProfile" TEXT,
    "weekdayVisitors" INTEGER,
    "weekendVisitors" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "agencyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storeName" TEXT,
    "managerUserId" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,
    "days" INTEGER,
    "boothCount" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_agencies" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,

    CONSTRAINT "event_agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booths" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floor" TEXT,
    "areaName" TEXT,
    "blockNumber" TEXT,
    "locationNote" TEXT,
    "areaSqm" DECIMAL(10,2),
    "widthM" DECIMAL(8,2),
    "depthM" DECIMAL(8,2),
    "boothFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "electricityFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "fixtureFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherEquipmentFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "setupFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "teardownFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "trafficDirection" TEXT,
    "aisleWidthM" DECIMAL(6,2),
    "visibilityScore" INTEGER,
    "dwellScore" INTEGER,
    "trafficScore" INTEGER,
    "hasCompetitor" BOOLEAN,
    "competitorProducts" TEXT,
    "adjacentStores" TEXT,
    "hasSeating" BOOLEAN,
    "outreachRangeM" DECIMAL(6,2),
    "facilityRestrictions" TEXT,
    "photos" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booth_tags" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booth_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_booth_tags" (
    "id" TEXT NOT NULL,
    "boothId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "event_booth_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agencyId" TEXT,
    "userId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "phone" TEXT,
    "employmentType" "EmploymentType" NOT NULL DEFAULT 'PART_TIME',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_compensations" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "compType" "CompensationType" NOT NULL DEFAULT 'HOURLY',
    "amount" DECIMAL(12,2) NOT NULL,
    "commissionRate" DECIMAL(9,6),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_staff_shifts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "boothId" TEXT,
    "staffId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "compType" "CompensationType" NOT NULL DEFAULT 'HOURLY',
    "unitAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_staff_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_metrics" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "boothId" TEXT,
    "metricDate" DATE NOT NULL,
    "hourSlot" INTEGER,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "passersby" INTEGER,
    "approaches" INTEGER,
    "stops" INTEGER,
    "seated" INTEGER,
    "meetings" INTEGER,
    "applications" INTEGER,
    "contractsCount" INTEGER,
    "activations" INTEGER,
    "cancellations" INTEGER,
    "staffCount" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subName" TEXT,
    "department" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountingCategoryId" TEXT,
    "plGroup" TEXT NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "accountingCategoryId" TEXT,
    "incurredOn" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxIncluded" BOOLEAN NOT NULL DEFAULT true,
    "taxCategory" "TaxCategory" NOT NULL DEFAULT 'TAXABLE_10',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "paidByUserId" TEXT,
    "agencyId" TEXT,
    "staffId" TEXT,
    "eventId" TEXT,
    "boothId" TEXT,
    "partnerId" TEXT,
    "receiptUrl" TEXT,
    "receiptMimeType" TEXT,
    "description" TEXT,
    "memo" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "paidOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_approvals" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "fromStatus" "ExpenseStatus" NOT NULL,
    "toStatus" "ExpenseStatus" NOT NULL,
    "actorUserId" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenues" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "RevenueSourceType" NOT NULL DEFAULT 'CONTRACT',
    "contractId" TEXT,
    "tossupId" TEXT,
    "customerId" TEXT,
    "productId" TEXT,
    "agencyId" TEXT,
    "eventId" TEXT,
    "boothId" TEXT,
    "staffId" TEXT,
    "recognizedOn" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "cost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "agencyPayout" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "referralFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossMargin" DECIMAL(9,6) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "partnerId" TEXT,
    "agencyId" TEXT,
    "periodStart" DATE,
    "periodEnd" DATE,
    "issuedOn" DATE NOT NULL,
    "dueOn" DATE,
    "subtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "pdfUrl" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxCategory" "TaxCategory" NOT NULL DEFAULT 'TAXABLE_10',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivables" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "revenueId" TEXT,
    "invoiceId" TEXT,
    "counterparty" TEXT NOT NULL,
    "dueOn" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidOn" DATE,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'NOT_BILLED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payables" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "partnerId" TEXT,
    "settlementId" TEXT,
    "counterparty" TEXT NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "adjustment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "dueOn" DATE NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "payableId" TEXT NOT NULL,
    "paidOn" DATE NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "periodMonth" DATE NOT NULL,
    "contractCount" INTEGER NOT NULL DEFAULT 0,
    "totalWatt" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "payoutAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "cancelDeduction" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "finalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "paidOn" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_items" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "contractId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isDeduction" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_allocations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "basis" "AllocationBasis" NOT NULL DEFAULT 'MANUAL',
    "targetType" TEXT NOT NULL,
    "eventId" TEXT,
    "targetAgencyId" TEXT,
    "department" TEXT,
    "ratio" DECIMAL(9,6) NOT NULL,
    "allocatedAmount" DECIMAL(18,2) NOT NULL,
    "periodMonth" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csv_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetEntity" "ImportTargetEntity" NOT NULL DEFAULT 'CUSTOMER_CONTRACT',
    "encoding" TEXT NOT NULL DEFAULT 'auto',
    "columnMappings" JSONB NOT NULL,
    "dedupeStrategy" JSONB,
    "defaultValues" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "csv_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agencyId" TEXT,
    "templateId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "encoding" TEXT NOT NULL DEFAULT 'UTF-8',
    "targetEntity" "ImportTargetEntity" NOT NULL DEFAULT 'CUSTOMER_CONTRACT',
    "columnMappings" JSONB,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "importedById" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "rolledBackAt" TIMESTAMP(3),
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "raw" JSONB NOT NULL,
    "normalized" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "errors" JSONB,
    "matchedBy" TEXT,
    "customerId" TEXT,
    "contractId" TEXT,
    "createdCustomer" BOOLEAN NOT NULL DEFAULT false,
    "createdContract" BOOLEAN NOT NULL DEFAULT false,
    "beforeSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "agencyId" TEXT,
    "actorUserId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_role_idx" ON "users"("organizationId", "role");

-- CreateIndex
CREATE INDEX "users_agencyId_idx" ON "users"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_providerId_accountId_key" ON "accounts"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE INDEX "agencies_organizationId_status_idx" ON "agencies"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_organizationId_code_key" ON "agencies"("organizationId", "code");

-- CreateIndex
CREATE INDEX "agency_unit_prices_agencyId_productId_effectiveFrom_idx" ON "agency_unit_prices"("agencyId", "productId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_code_key" ON "products"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_organizationId_code_key" ON "suppliers"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "plans_supplierId_code_key" ON "plans"("supplierId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "contract_statuses_organizationId_code_key" ON "contract_statuses"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "upsell_statuses_organizationId_code_key" ON "upsell_statuses"("organizationId", "code");

-- CreateIndex
CREATE INDEX "pricing_rules_organizationId_side_effectiveFrom_idx" ON "pricing_rules"("organizationId", "side", "effectiveFrom");

-- CreateIndex
CREATE INDEX "pricing_rules_agencyId_side_idx" ON "pricing_rules"("agencyId", "side");

-- CreateIndex
CREATE INDEX "customers_organizationId_agencyId_idx" ON "customers"("organizationId", "agencyId");

-- CreateIndex
CREATE INDEX "customers_organizationId_phoneNormalized_idx" ON "customers"("organizationId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "customers_organizationId_externalCustomerId_idx" ON "customers"("organizationId", "externalCustomerId");

-- CreateIndex
CREATE INDEX "customers_organizationId_name_idx" ON "customers"("organizationId", "name");

-- CreateIndex
CREATE INDEX "contracts_organizationId_agencyId_contractedAt_idx" ON "contracts"("organizationId", "agencyId", "contractedAt");

-- CreateIndex
CREATE INDEX "contracts_organizationId_statusId_idx" ON "contracts"("organizationId", "statusId");

-- CreateIndex
CREATE INDEX "contracts_eventId_boothId_idx" ON "contracts"("eventId", "boothId");

-- CreateIndex
CREATE INDEX "contracts_staffId_idx" ON "contracts"("staffId");

-- CreateIndex
CREATE INDEX "contracts_customerId_idx" ON "contracts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_organizationId_contractNumber_key" ON "contracts"("organizationId", "contractNumber");

-- CreateIndex
CREATE INDEX "contract_pricing_snapshots_contractId_createdAt_idx" ON "contract_pricing_snapshots"("contractId", "createdAt");

-- CreateIndex
CREATE INDEX "customer_activities_customerId_occurredAt_idx" ON "customer_activities"("customerId", "occurredAt");

-- CreateIndex
CREATE INDEX "upsell_leads_organizationId_statusId_idx" ON "upsell_leads"("organizationId", "statusId");

-- CreateIndex
CREATE INDEX "upsell_leads_organizationId_nextActionAt_idx" ON "upsell_leads"("organizationId", "nextActionAt");

-- CreateIndex
CREATE UNIQUE INDEX "upsell_leads_customerId_productId_key" ON "upsell_leads"("customerId", "productId");

-- CreateIndex
CREATE INDEX "upsell_activities_upsellLeadId_createdAt_idx" ON "upsell_activities"("upsellLeadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "partners_organizationId_code_key" ON "partners"("organizationId", "code");

-- CreateIndex
CREATE INDEX "tossups_organizationId_status_idx" ON "tossups"("organizationId", "status");

-- CreateIndex
CREATE INDEX "tossups_upsellLeadId_idx" ON "tossups"("upsellLeadId");

-- CreateIndex
CREATE INDEX "facilities_organizationId_prefecture_idx" ON "facilities"("organizationId", "prefecture");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_organizationId_code_key" ON "facilities"("organizationId", "code");

-- CreateIndex
CREATE INDEX "events_organizationId_startDate_idx" ON "events"("organizationId", "startDate");

-- CreateIndex
CREATE INDEX "events_facilityId_startDate_idx" ON "events"("facilityId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "events_organizationId_code_key" ON "events"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "event_agencies_eventId_agencyId_key" ON "event_agencies"("eventId", "agencyId");

-- CreateIndex
CREATE INDEX "booths_facilityId_floor_areaName_idx" ON "booths"("facilityId", "floor", "areaName");

-- CreateIndex
CREATE UNIQUE INDEX "booths_eventId_code_key" ON "booths"("eventId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "booth_tags_organizationId_code_key" ON "booth_tags"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "event_booth_tags_boothId_tagId_key" ON "event_booth_tags"("boothId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_userId_key" ON "staff"("userId");

-- CreateIndex
CREATE INDEX "staff_organizationId_agencyId_idx" ON "staff"("organizationId", "agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_organizationId_code_key" ON "staff"("organizationId", "code");

-- CreateIndex
CREATE INDEX "staff_compensations_staffId_effectiveFrom_idx" ON "staff_compensations"("staffId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "event_staff_shifts_staffId_workDate_idx" ON "event_staff_shifts"("staffId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "event_staff_shifts_eventId_staffId_workDate_startTime_key" ON "event_staff_shifts"("eventId", "staffId", "workDate", "startTime");

-- CreateIndex
CREATE INDEX "event_metrics_eventId_metricDate_idx" ON "event_metrics"("eventId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "event_metrics_eventId_boothId_metricDate_hourSlot_key" ON "event_metrics"("eventId", "boothId", "metricDate", "hourSlot");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_categories_organizationId_code_key" ON "accounting_categories"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_organizationId_code_key" ON "expense_categories"("organizationId", "code");

-- CreateIndex
CREATE INDEX "expenses_organizationId_incurredOn_idx" ON "expenses"("organizationId", "incurredOn");

-- CreateIndex
CREATE INDEX "expenses_eventId_idx" ON "expenses"("eventId");

-- CreateIndex
CREATE INDEX "expenses_organizationId_status_idx" ON "expenses"("organizationId", "status");

-- CreateIndex
CREATE INDEX "expense_approvals_expenseId_createdAt_idx" ON "expense_approvals"("expenseId", "createdAt");

-- CreateIndex
CREATE INDEX "revenues_organizationId_recognizedOn_idx" ON "revenues"("organizationId", "recognizedOn");

-- CreateIndex
CREATE INDEX "revenues_customerId_idx" ON "revenues"("customerId");

-- CreateIndex
CREATE INDEX "revenues_eventId_idx" ON "revenues"("eventId");

-- CreateIndex
CREATE INDEX "invoices_organizationId_issuedOn_idx" ON "invoices"("organizationId", "issuedOn");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organizationId_invoiceNumber_key" ON "invoices"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "receivables_organizationId_dueOn_idx" ON "receivables"("organizationId", "dueOn");

-- CreateIndex
CREATE INDEX "receivables_organizationId_status_idx" ON "receivables"("organizationId", "status");

-- CreateIndex
CREATE INDEX "payables_organizationId_dueOn_idx" ON "payables"("organizationId", "dueOn");

-- CreateIndex
CREATE INDEX "payables_organizationId_status_idx" ON "payables"("organizationId", "status");

-- CreateIndex
CREATE INDEX "payments_payableId_idx" ON "payments"("payableId");

-- CreateIndex
CREATE INDEX "settlements_organizationId_periodMonth_idx" ON "settlements"("organizationId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_agencyId_periodMonth_key" ON "settlements"("agencyId", "periodMonth");

-- CreateIndex
CREATE INDEX "settlement_items_settlementId_idx" ON "settlement_items"("settlementId");

-- CreateIndex
CREATE INDEX "cost_allocations_expenseId_idx" ON "cost_allocations"("expenseId");

-- CreateIndex
CREATE INDEX "cost_allocations_organizationId_periodMonth_idx" ON "cost_allocations"("organizationId", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "csv_templates_organizationId_name_key" ON "csv_templates"("organizationId", "name");

-- CreateIndex
CREATE INDEX "import_batches_organizationId_createdAt_idx" ON "import_batches"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "import_batches_organizationId_fileHash_idx" ON "import_batches"("organizationId", "fileHash");

-- CreateIndex
CREATE INDEX "import_rows_batchId_status_idx" ON "import_rows"("batchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_batchId_rowNumber_key" ON "import_rows"("batchId", "rowNumber");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agencies" ADD CONSTRAINT "agencies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_unit_prices" ADD CONSTRAINT "agency_unit_prices_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_unit_prices" ADD CONSTRAINT "agency_unit_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_unit_prices" ADD CONSTRAINT "agency_unit_prices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_statuses" ADD CONSTRAINT "contract_statuses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_statuses" ADD CONSTRAINT "upsell_statuses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_rules" ADD CONSTRAINT "pricing_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_sourceBoothId_fkey" FOREIGN KEY ("sourceBoothId") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "contract_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_pricing_snapshots" ADD CONSTRAINT "contract_pricing_snapshots_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_pricing_snapshots" ADD CONSTRAINT "contract_pricing_snapshots_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_upsellLeadId_fkey" FOREIGN KEY ("upsellLeadId") REFERENCES "upsell_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_activities" ADD CONSTRAINT "customer_activities_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_leads" ADD CONSTRAINT "upsell_leads_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_leads" ADD CONSTRAINT "upsell_leads_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_leads" ADD CONSTRAINT "upsell_leads_sourceContractId_fkey" FOREIGN KEY ("sourceContractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_leads" ADD CONSTRAINT "upsell_leads_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "upsell_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_leads" ADD CONSTRAINT "upsell_leads_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_activities" ADD CONSTRAINT "upsell_activities_upsellLeadId_fkey" FOREIGN KEY ("upsellLeadId") REFERENCES "upsell_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_activities" ADD CONSTRAINT "upsell_activities_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "upsell_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_activities" ADD CONSTRAINT "upsell_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tossups" ADD CONSTRAINT "tossups_upsellLeadId_fkey" FOREIGN KEY ("upsellLeadId") REFERENCES "upsell_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tossups" ADD CONSTRAINT "tossups_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tossups" ADD CONSTRAINT "tossups_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_agencies" ADD CONSTRAINT "event_agencies_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_agencies" ADD CONSTRAINT "event_agencies_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booths" ADD CONSTRAINT "booths_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booths" ADD CONSTRAINT "booths_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booth_tags" ADD CONSTRAINT "booth_tags_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_booth_tags" ADD CONSTRAINT "event_booth_tags_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "booths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_booth_tags" ADD CONSTRAINT "event_booth_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "booth_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_compensations" ADD CONSTRAINT "staff_compensations_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_staff_shifts" ADD CONSTRAINT "event_staff_shifts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_staff_shifts" ADD CONSTRAINT "event_staff_shifts_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_staff_shifts" ADD CONSTRAINT "event_staff_shifts_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_metrics" ADD CONSTRAINT "event_metrics_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_metrics" ADD CONSTRAINT "event_metrics_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_categories" ADD CONSTRAINT "accounting_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "expense_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_accountingCategoryId_fkey" FOREIGN KEY ("accountingCategoryId") REFERENCES "accounting_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_accountingCategoryId_fkey" FOREIGN KEY ("accountingCategoryId") REFERENCES "accounting_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paidByUserId_fkey" FOREIGN KEY ("paidByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approvals" ADD CONSTRAINT "expense_approvals_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_approvals" ADD CONSTRAINT "expense_approvals_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_tossupId_fkey" FOREIGN KEY ("tossupId") REFERENCES "tossups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_boothId_fkey" FOREIGN KEY ("boothId") REFERENCES "booths"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenues" ADD CONSTRAINT "revenues_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_revenueId_fkey" FOREIGN KEY ("revenueId") REFERENCES "revenues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receivables" ADD CONSTRAINT "receivables_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payables" ADD CONSTRAINT "payables_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payableId_fkey" FOREIGN KEY ("payableId") REFERENCES "payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_allocations" ADD CONSTRAINT "cost_allocations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csv_templates" ADD CONSTRAINT "csv_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "csv_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
