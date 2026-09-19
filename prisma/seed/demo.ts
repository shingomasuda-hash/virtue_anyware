import { Prisma } from '../../src/generated/prisma/index.js';
import { prisma } from './client.js';
import { priceContract } from '../../src/server/services/pricing/snapshot.js';
import { seedUser } from './users.js';
import type { Masters } from './masters.js';

/** 再現性のある擬似乱数（seed 固定）。デモデータを毎回同じにする。 */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const FAMILY_NAMES = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
const GIVEN_NAMES = ['太郎', '花子', '一郎', '美咲', '健太', '由美', '翔太', '彩', '大輔', '恵子'];
const FAMILY_KANA = ['サトウ', 'スズキ', 'タカハシ', 'タナカ', 'イトウ', 'ワタナベ', 'ヤマモト', 'ナカムラ', 'コバヤシ', 'カトウ'];
const GIVEN_KANA = ['タロウ', 'ハナコ', 'イチロウ', 'ミサキ', 'ケンタ', 'ユミ', 'ショウタ', 'アヤ', 'ダイスケ', 'ケイコ'];

const AGENCY_SEEDS = [
  { code: 'AG-A', name: 'Agency A', corporateName: '株式会社エーセールス', prefecture: '東京都', city: '新宿区', unitPrice: 100, contact: '青木 亮' },
  { code: 'AG-B', name: 'Agency B', corporateName: '株式会社ビーコミュニケーションズ', prefecture: '大阪府', city: '北区', unitPrice: 95, contact: '井上 学' },
  { code: 'AG-C', name: 'Agency C', corporateName: '合同会社シープロモーション', prefecture: '愛知県', city: '名古屋市中区', unitPrice: 110, contact: '上田 沙織' },
] as const;

/** 契約ステータスの配分（開通済 / 審査中 / キャンセル / 不備 などを混在させる §36）。 */
const STATUS_MIX = ['ACTIVATED', 'ACTIVATED', 'ACTIVATED', 'SCREENING', 'WAITING_ACTIVATION', 'CONFIRMED', 'CANCELLED', 'DEFECT', 'ACTIVATED', 'APPLIED'] as const;

/** アップセルステータスの配分（§36）。 */
const UPSELL_MIX = ['NEW', 'NEW', 'CALLING', 'NO_ANSWER', 'INTERESTED', 'APPOINTMENT', 'TOSSED_UP', 'NEGOTIATING', 'WON', 'NOT_INTERESTED'] as const;

const HQ_UNIT_PRICE = 150;

export async function seedDemo(masters: Masters) {
  const { organizationId } = masters;
  const random = createRandom(20260919);
  const today = new Date(2026, 8, 19); // 2026-09-19

  // ── 本部ユーザー ──
  await seedUser(organizationId, { email: 'superadmin@virtue.example.jp', name: 'システム管理者', role: 'SUPER_ADMIN' });
  const hqAdmin = await seedUser(organizationId, { email: 'hq.admin@virtue.example.jp', name: '本部 管理者', role: 'HQ_ADMIN' });
  const hqStaff = await seedUser(organizationId, { email: 'hq.staff@virtue.example.jp', name: '本部 スタッフ', role: 'HQ_STAFF' });

  // ── 本部受取単価（§6: 150円/W）──
  await prisma.pricingRule.deleteMany({ where: { organizationId } });
  await prisma.pricingRule.create({
    data: {
      organizationId,
      side: 'HQ_RECEIVE',
      productId: masters.products.ELEC ?? null,
      unitType: 'PER_WATT',
      unitPrice: new Prisma.Decimal(HQ_UNIT_PRICE),
      effectiveFrom: new Date(2026, 0, 1),
      note: '上位会社からの受取単価（電力）',
      createdById: hqAdmin.id,
    },
  });
  // 太陽光紹介料は販売額の 10%（単価の意味が異なる例）
  await prisma.pricingRule.create({
    data: {
      organizationId,
      side: 'HQ_RECEIVE',
      productId: masters.products.SOLAR ?? null,
      unitType: 'PERCENT_OF_AMOUNT',
      unitPrice: new Prisma.Decimal(0),
      rate: new Prisma.Decimal(0.1),
      effectiveFrom: new Date(2026, 0, 1),
      note: '太陽光の紹介料（販売額の10%）',
      createdById: hqAdmin.id,
    },
  });

  // ── 施設 / 催事 / ブース ──
  const facility = await prisma.facility.upsert({
    where: { organizationId_code: { organizationId, code: 'FAC-001' } },
    update: {},
    create: {
      organizationId,
      code: 'FAC-001',
      name: 'イオンモール幕張新都心',
      operatorName: 'イオンモール株式会社',
      facilityType: 'ショッピングモール',
      prefecture: '千葉県',
      city: '千葉市美浜区',
      address: '豊砂1-1',
      weekdayVisitors: 28000,
      weekendVisitors: 52000,
    },
  });
  const facility2 = await prisma.facility.upsert({
    where: { organizationId_code: { organizationId, code: 'FAC-002' } },
    update: {},
    create: {
      organizationId,
      code: 'FAC-002',
      name: 'ららぽーと豊洲',
      operatorName: '三井不動産株式会社',
      facilityType: 'ショッピングモール',
      prefecture: '東京都',
      city: '江東区',
      address: '豊洲2-4-9',
    },
  });

  // ── 代理店・単価履歴・ユーザー・スタッフ ──
  const agencies: Array<{ id: string; code: string; name: string }> = [];
  for (const seed of AGENCY_SEEDS) {
    const agency = await prisma.agency.upsert({
      where: { organizationId_code: { organizationId, code: seed.code } },
      update: { name: seed.name },
      create: {
        organizationId,
        code: seed.code,
        name: seed.name,
        corporateName: seed.corporateName,
        contactPerson: seed.contact,
        phone: '03-0000-0000',
        email: `${seed.code.toLowerCase()}@example.jp`,
        postalCode: '100-0001',
        prefecture: seed.prefecture,
        city: seed.city,
        address: '1-1-1',
        contractStartDate: new Date(2026, 0, 1),
        status: 'ACTIVE',
        paymentTerms: '月末締め 翌月末払い',
        paymentClosingDay: 31,
        paymentMonthOffset: 1,
        paymentDay: 31,
        bankName: 'みずほ銀行',
        bankBranch: '新宿支店',
        bankAccountType: '普通',
        bankAccountNumber: '1234567',
        bankAccountHolder: seed.corporateName,
      },
    });
    agencies.push({ id: agency.id, code: agency.code, name: agency.name });

    // 単価履歴: 適用期間つき。改定しても過去契約の金額は変わらない（§5）
    await prisma.agencyUnitPrice.deleteMany({ where: { agencyId: agency.id } });
    await prisma.agencyUnitPrice.createMany({
      data: [
        {
          agencyId: agency.id,
          productId: masters.products.ELEC ?? null,
          unitType: 'PER_WATT',
          unitPrice: new Prisma.Decimal(seed.unitPrice - 5),
          effectiveFrom: new Date(2026, 0, 1),
          effectiveTo: new Date(2026, 5, 30),
          note: '初期単価',
          createdById: hqAdmin.id,
        },
        {
          agencyId: agency.id,
          productId: masters.products.ELEC ?? null,
          unitType: 'PER_WATT',
          unitPrice: new Prisma.Decimal(seed.unitPrice),
          effectiveFrom: new Date(2026, 6, 1),
          note: '2026年7月改定',
          createdById: hqAdmin.id,
        },
      ],
    });

    await seedUser(organizationId, {
      email: `${seed.code.toLowerCase()}.admin@example.jp`,
      name: `${seed.name} 管理者`,
      role: 'AGENCY_ADMIN',
      agencyId: agency.id,
    });
    await seedUser(organizationId, {
      email: `${seed.code.toLowerCase()}.staff@example.jp`,
      name: `${seed.name} スタッフ`,
      role: 'AGENCY_STAFF',
      agencyId: agency.id,
    });
  }

  // 販売スタッフ（アプリユーザーとは別。催事シフト・スタッフ分析で使う）
  const staffIds: string[] = [];
  for (const [index, agency] of agencies.entries()) {
    for (let s = 1; s <= 2; s += 1) {
      const code = `ST-${agency.code}-${s}`;
      const staff = await prisma.staff.upsert({
        where: { organizationId_code: { organizationId, code } },
        update: {},
        create: {
          organizationId,
          agencyId: agency.id,
          code,
          name: `${FAMILY_NAMES[(index * 2 + s) % FAMILY_NAMES.length]} ${GIVEN_NAMES[(index + s) % GIVEN_NAMES.length]}`,
          employmentType: s === 1 ? 'EMPLOYEE' : 'PART_TIME',
        },
      });
      staffIds.push(staff.id);
      // 給与単価も有効期間つき（改定で過去催事の利益が変わらない §62）
      await prisma.staffCompensation.deleteMany({ where: { staffId: staff.id } });
      await prisma.staffCompensation.create({
        data: {
          staffId: staff.id,
          compType: s === 1 ? 'DAILY' : 'HOURLY',
          amount: new Prisma.Decimal(s === 1 ? 18000 : 1400),
          effectiveFrom: new Date(2026, 0, 1),
        },
      });
    }
  }

  // ── 催事 / ブース / シフト / ファネル実績 ──
  const eventDefs = [
    { code: 'EV-2026-07', name: '幕張 夏の電力切替フェア', facilityId: facility.id, start: new Date(2026, 6, 10), end: new Date(2026, 6, 12), agencyIndex: 0 },
    { code: 'EV-2026-08', name: '豊洲 電力見直し相談会', facilityId: facility2.id, start: new Date(2026, 7, 14), end: new Date(2026, 7, 16), agencyIndex: 1 },
    { code: 'EV-2026-09', name: '幕張 秋の省エネ相談会', facilityId: facility.id, start: new Date(2026, 8, 4), end: new Date(2026, 8, 6), agencyIndex: 2 },
  ];

  const events: Array<{ id: string; boothIds: string[] }> = [];
  for (const def of eventDefs) {
    const agency = agencies[def.agencyIndex];
    const event = await prisma.event.upsert({
      where: { organizationId_code: { organizationId, code: def.code } },
      update: {},
      create: {
        organizationId,
        facilityId: def.facilityId,
        agencyId: agency?.id ?? null,
        code: def.code,
        name: def.name,
        storeName: def.facilityId === facility.id ? 'イオンモール幕張新都心' : 'ららぽーと豊洲',
        managerUserId: hqStaff.id,
        startDate: def.start,
        endDate: def.end,
        openTime: '10:00',
        closeTime: '20:00',
        days: 3,
        boothCount: 2,
        status: 'FINISHED',
      },
    });

    const boothIds: string[] = [];
    const boothDefs = [
      { code: 'B1', floor: '1F', areaName: '食品入口前', boothFee: 90000, tags: ['ENTRANCE', 'FOOD'], visibility: 5, dwell: 4 },
      { code: 'B2', floor: '2F', areaName: 'エスカレーター前', boothFee: 60000, tags: ['ESCALATOR', 'SPECIALTY'], visibility: 3, dwell: 2 },
    ];
    for (const b of boothDefs) {
      const booth = await prisma.booth.upsert({
        where: { eventId_code: { eventId: event.id, code: b.code } },
        update: {},
        create: {
          eventId: event.id,
          facilityId: def.facilityId,
          code: b.code,
          floor: b.floor,
          areaName: b.areaName,
          areaSqm: new Prisma.Decimal(9),
          widthM: new Prisma.Decimal(3),
          depthM: new Prisma.Decimal(3),
          boothFee: new Prisma.Decimal(b.boothFee),
          electricityFee: new Prisma.Decimal(5000),
          fixtureFee: new Prisma.Decimal(12000),
          setupFee: new Prisma.Decimal(20000),
          teardownFee: new Prisma.Decimal(15000),
          visibilityScore: b.visibility,
          dwellScore: b.dwell,
          trafficScore: b.visibility,
          hasCompetitor: b.code === 'B2',
          hasSeating: true,
        },
      });
      boothIds.push(booth.id);
      for (const tagCode of b.tags) {
        const tagId = masters.boothTags[tagCode];
        if (!tagId) continue;
        await prisma.eventBoothTag.upsert({
          where: { boothId_tagId: { boothId: booth.id, tagId } },
          update: {},
          create: { boothId: booth.id, tagId },
        });
      }

      // 催事ファネル実績（取れた分だけ入力する想定 §54）
      for (let d = 0; d < 3; d += 1) {
        const metricDate = new Date(def.start.getFullYear(), def.start.getMonth(), def.start.getDate() + d);
        // hourSlot が NULL の行は複合 unique で一意化できない（Postgres は NULL を区別する）ため
        // findFirst で存在確認してから作成する。
        const existingMetric = await prisma.eventMetric.findFirst({
          where: { eventId: event.id, boothId: booth.id, metricDate, hourSlot: null },
        });
        if (existingMetric) continue;
        await prisma.eventMetric.create({
          data: {
            eventId: event.id,
            boothId: booth.id,
            metricDate,
            isHoliday: metricDate.getDay() === 0 || metricDate.getDay() === 6,
            passersby: Math.round(2000 + random() * 1500),
            approaches: Math.round(120 + random() * 60),
            stops: Math.round(60 + random() * 30),
            seated: Math.round(30 + random() * 15),
            meetings: Math.round(18 + random() * 8),
            applications: Math.round(6 + random() * 4),
            staffCount: 2,
          },
        });
      }
    }
    events.push({ id: event.id, boothIds });

    // スタッフシフト（人件費はスナップショット保存 §62）
    for (const [i, staffId] of staffIds.slice(def.agencyIndex * 2, def.agencyIndex * 2 + 2).entries()) {
      for (let d = 0; d < 3; d += 1) {
        const workDate = new Date(def.start.getFullYear(), def.start.getMonth(), def.start.getDate() + d);
        const comp = await prisma.staffCompensation.findFirst({ where: { staffId }, orderBy: { effectiveFrom: 'desc' } });
        const workedMinutes = 600 - 60;
        const laborCost = comp?.compType === 'DAILY'
          ? Number(comp.amount)
          : Math.round((workedMinutes / 60) * Number(comp?.amount ?? 0));
        await prisma.eventStaffShift.upsert({
          where: { eventId_staffId_workDate_startTime: { eventId: event.id, staffId, workDate, startTime: '10:00' } },
          update: {},
          create: {
            eventId: event.id,
            boothId: boothIds[i % boothIds.length] ?? null,
            staffId,
            workDate,
            startTime: '10:00',
            endTime: '20:00',
            breakMinutes: 60,
            workedMinutes,
            laborCost: new Prisma.Decimal(laborCost),
            compType: comp?.compType ?? 'HOURLY',
            unitAmount: new Prisma.Decimal(Number(comp?.amount ?? 0)),
          },
        });
      }
    }

    // 催事経費（催事PL の元データ §44/§52）
    const expenseDefs = [
      { code: 'BOOTH_FEE', amount: 150000, description: 'ブース出店料' },
      { code: 'LABOR_PART', amount: 120000, description: 'アルバイト人件費' },
      { code: 'TRAVEL', amount: 40000, description: '現地までの交通費' },
      { code: 'HOTEL', amount: 30000, description: 'スタッフ宿泊費' },
      { code: 'PROMOTION', amount: 20000, description: 'のぼり・チラシ' },
    ];
    for (const e of expenseDefs) {
      const categoryId = masters.expenseCategories[e.code];
      if (!categoryId) continue;
      const exists = await prisma.expense.findFirst({ where: { eventId: event.id, categoryId, description: e.description } });
      if (exists) continue;
      await prisma.expense.create({
        data: {
          organizationId,
          categoryId,
          eventId: event.id,
          boothId: boothIds[0] ?? null,
          agencyId: agency?.id ?? null,
          incurredOn: def.end,
          amount: new Prisma.Decimal(e.amount),
          taxAmount: new Prisma.Decimal(Math.round((e.amount * 10) / 110)),
          taxIncluded: true,
          description: e.description,
          status: 'APPROVED',
          approvedAt: def.end,
          approvedByUserId: hqAdmin.id,
          paidByUserId: hqStaff.id,
        },
      });
    }
  }

  // ── 顧客 / 契約 / アップセル ──
  let customerIndex = 0;
  for (const [agencyIdx, agency] of agencies.entries()) {
    const event = events[agencyIdx];
    for (let i = 0; i < 10; i += 1) {
      customerIndex += 1;
      const family = FAMILY_NAMES[(customerIndex * 3) % FAMILY_NAMES.length] ?? '佐藤';
      const given = GIVEN_NAMES[(customerIndex * 7) % GIVEN_NAMES.length] ?? '太郎';
      const externalId = `${agency.code}-C${String(i + 1).padStart(3, '0')}`;
      const phone = `090${String(10000000 + customerIndex * 137).slice(0, 8)}`;
      const contractedAt = new Date(2026, 6 + agencyIdx, 10 + (i % 3));

      const customer = await prisma.customer.upsert({
        where: { id: `seed-cust-${externalId}` },
        update: {},
        create: {
          id: `seed-cust-${externalId}`,
          organizationId,
          agencyId: agency.id,
          externalCustomerId: externalId,
          name: `${family} ${given}`,
          nameKana: `${FAMILY_KANA[(customerIndex * 3) % FAMILY_KANA.length]} ${GIVEN_KANA[(customerIndex * 7) % GIVEN_KANA.length]}`,
          phone,
          phoneNormalized: phone,
          email: `${externalId.toLowerCase()}@example.jp`,
          postalCode: '261-8535',
          prefecture: ['千葉県', '東京都', '愛知県'][agencyIdx] ?? '東京都',
          city: ['千葉市美浜区', '江東区', '名古屋市中区'][agencyIdx] ?? '江東区',
          address: `${i + 1}-${customerIndex}`,
          birthDate: new Date(1970 + (customerIndex % 30), customerIndex % 12, 1 + (customerIndex % 27)),
          assignedUserId: hqStaff.id,
          sourceEventId: event?.id ?? null,
          sourceBoothId: event?.boothIds[i % 2] ?? null,
          acquiredAt: contractedAt,
        },
      });

      // ── 契約（単価は「契約日時点」のマスタから解決してスナップショット保存）──
      const statusCode = STATUS_MIX[i % STATUS_MIX.length] ?? 'ACTIVATED';
      const statusId = masters.contractStatuses[statusCode];
      if (!statusId) continue;
      const watt = 3000 + (customerIndex % 5) * 1000;

      // 金額は本番と同じ計算サービスを通す。
      // seed が独自計算をすると本番経路との乖離に気づけなくなるため。
      const priced = await priceContract({
        organizationId,
        agencyId: agency.id,
        productId: masters.products.ELEC ?? '',
        supplierId: masters.suppliers[i % 2 === 0 ? 'PWR_A' : 'PWR_B'] ?? null,
        planId: masters.plans[i % 2 === 0 ? 'PWR_A_P1' : 'PWR_B_P1'] ?? null,
        quantity: watt,
        basisDate: contractedAt,
      });
      const agencyUnitPrice = priced.agencyUnitPrice;
      const hqRevenue = priced.hqRevenue;
      const agencyPayout = priced.agencyPayout;
      const hqGrossProfit = priced.hqGrossProfit;

      const contractNumber = `${agency.code}-${String(customerIndex).padStart(5, '0')}`;
      const isCancelled = statusCode === 'CANCELLED';
      const isActivated = statusCode === 'ACTIVATED';

      const contract = await prisma.contract.upsert({
        where: { organizationId_contractNumber: { organizationId, contractNumber } },
        update: {},
        create: {
          organizationId,
          agencyId: agency.id,
          customerId: customer.id,
          productId: masters.products.ELEC ?? '',
          contractNumber,
          supplierId: masters.suppliers[i % 2 === 0 ? 'PWR_A' : 'PWR_B'] ?? null,
          planId: masters.plans[i % 2 === 0 ? 'PWR_A_P1' : 'PWR_B_P1'] ?? null,
          quantity: new Prisma.Decimal(watt),
          contractWatt: new Prisma.Decimal(watt),
          statusId,
          appliedAt: contractedAt,
          contractedAt,
          activatedAt: isActivated ? new Date(contractedAt.getFullYear(), contractedAt.getMonth() + 1, 1) : null,
          cancelledAt: isCancelled ? new Date(contractedAt.getFullYear(), contractedAt.getMonth(), contractedAt.getDate() + 5) : null,
          cancelReason: isCancelled ? '顧客都合による解約' : null,
          contractedTime: new Date(contractedAt.getFullYear(), contractedAt.getMonth(), contractedAt.getDate(), 11 + (i % 8)),
          eventId: event?.id ?? null,
          boothId: event?.boothIds[i % 2] ?? null,
          staffId: staffIds[agencyIdx * 2 + (i % 2)] ?? null,
          campaign: '夏の電力切替キャンペーン',
          hqUnitPrice: new Prisma.Decimal(priced.hqUnitPrice),
          agencyUnitPrice: new Prisma.Decimal(agencyUnitPrice),
          hqRevenue: new Prisma.Decimal(hqRevenue),
          agencyPayout: new Prisma.Decimal(agencyPayout),
          hqGrossProfit: new Prisma.Decimal(hqGrossProfit),
          grossMargin: new Prisma.Decimal(priced.grossMargin),
          pricedAt: contractedAt,
        },
      });

      await prisma.contractPricingSnapshot.create({
        data: {
          contractId: contract.id,
          reason: 'seed:initial',
          basisDate: priced.basisDate,
          quantity: new Prisma.Decimal(priced.quantity),
          hqUnitPrice: new Prisma.Decimal(priced.hqUnitPrice),
          agencyUnitPrice: new Prisma.Decimal(agencyUnitPrice),
          hqUnitType: priced.hqUnitType,
          agencyUnitType: priced.agencyUnitType,
          hqRevenue: new Prisma.Decimal(hqRevenue),
          agencyPayout: new Prisma.Decimal(agencyPayout),
          hqGrossProfit: new Prisma.Decimal(hqGrossProfit),
          grossMargin: new Prisma.Decimal(priced.grossMargin),
          hqPricingRuleId: priced.hqPricingRuleId,
          agencyPriceId: priced.agencyPriceId,
          createdById: hqAdmin.id,
        },
      });

      await prisma.customerActivity.createMany({
        data: [
          {
            organizationId,
            customerId: customer.id,
            contractId: contract.id,
            type: 'CONTRACT_CREATED',
            title: '電力契約を登録しました',
            body: `${contractNumber} / ${watt.toLocaleString()}W`,
            actorUserId: hqAdmin.id,
            occurredAt: contractedAt,
          },
          {
            organizationId,
            customerId: customer.id,
            contractId: contract.id,
            type: 'STATUS_CHANGED',
            title: `契約ステータスを「${statusCode}」に変更しました`,
            actorUserId: hqStaff.id,
            occurredAt: new Date(contractedAt.getFullYear(), contractedAt.getMonth(), contractedAt.getDate() + 2),
          },
        ],
      });

      // 売上明細（分析軸の FK をすべて持つ fact）
      if (!isCancelled) {
        await prisma.revenue.create({
          data: {
            organizationId,
            sourceType: 'CONTRACT',
            contractId: contract.id,
            customerId: customer.id,
            productId: masters.products.ELEC ?? null,
            agencyId: agency.id,
            eventId: event?.id ?? null,
            boothId: event?.boothIds[i % 2] ?? null,
            staffId: staffIds[agencyIdx * 2 + (i % 2)] ?? null,
            recognizedOn: contractedAt,
            amount: new Prisma.Decimal(hqRevenue),
            agencyPayout: new Prisma.Decimal(agencyPayout),
            grossProfit: new Prisma.Decimal(hqGrossProfit),
            grossMargin: new Prisma.Decimal(priced.grossMargin),
          },
        });
      }

      // ── アップセルリード（電力契約登録で自動生成される想定 §18）──
      if (isCancelled) continue;
      const upsellCode = UPSELL_MIX[i % UPSELL_MIX.length] ?? 'NEW';
      const upsellStatusId = masters.upsellStatuses[upsellCode];
      const upsellProductId = masters.products[i % 3 === 0 ? 'SOLAR' : i % 3 === 1 ? 'BATTERY' : 'SOLAR_BATTERY'];
      if (!upsellStatusId || !upsellProductId) continue;

      const called = !['NEW', 'CALL_SCHEDULED'].includes(upsellCode);
      const lead = await prisma.upsellLead.upsert({
        where: { customerId_productId: { customerId: customer.id, productId: upsellProductId } },
        update: {},
        create: {
          organizationId,
          customerId: customer.id,
          productId: upsellProductId,
          sourceContractId: contract.id,
          statusId: upsellStatusId,
          assignedUserId: hqStaff.id,
          callCount: called ? 1 + (i % 3) : 0,
          lastCalledAt: called ? new Date(contractedAt.getFullYear(), contractedAt.getMonth() + 1, 5) : null,
          nextActionAt: called ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + (i % 7)) : null,
        },
      });

      if (called) {
        await prisma.upsellActivity.create({
          data: {
            upsellLeadId: lead.id,
            type: 'CALL',
            calledAt: new Date(contractedAt.getFullYear(), contractedAt.getMonth() + 1, 5),
            connected: upsellCode !== 'NO_ANSWER',
            reaction: upsellCode === 'INTERESTED' ? '太陽光に関心あり' : null,
            nextCallAt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3),
            memo: '初回架電',
            statusId: upsellStatusId,
            userId: hqStaff.id,
          },
        });
        await prisma.customerActivity.create({
          data: {
            organizationId,
            customerId: customer.id,
            upsellLeadId: lead.id,
            type: 'CALL',
            title: 'アップセル架電',
            body: upsellCode === 'NO_ANSWER' ? '不通' : '接続',
            actorUserId: hqStaff.id,
            occurredAt: new Date(contractedAt.getFullYear(), contractedAt.getMonth() + 1, 5),
          },
        });
      }

      // トスアップ以降のステータスはトスアップ実績を持たせる
      if (['TOSSED_UP', 'NEGOTIATING', 'WON'].includes(upsellCode)) {
        const partnerId = masters.partners[i % 2 === 0 ? 'SOLAR_CO_1' : 'SOLAR_CO_2'];
        const tossedAt = new Date(contractedAt.getFullYear(), contractedAt.getMonth() + 1, 12);
        const isWon = upsellCode === 'WON';
        const expectedRevenue = 2_500_000;
        const referralFee = 150_000;
        const tossup = await prisma.tossup.create({
          data: {
            organizationId,
            upsellLeadId: lead.id,
            partnerId: partnerId ?? null,
            productId: upsellProductId,
            tossedAt,
            partnerContactName: '担当 太郎',
            meetingScheduledAt: new Date(tossedAt.getFullYear(), tossedAt.getMonth(), tossedAt.getDate() + 7),
            expectedRevenue: new Prisma.Decimal(expectedRevenue),
            referralFee: new Prisma.Decimal(referralFee),
            status: isWon ? 'WON' : upsellCode === 'NEGOTIATING' ? 'MEETING_DONE' : 'TOSSED',
            result: isWon ? '成約' : null,
            closedAt: isWon ? new Date(tossedAt.getFullYear(), tossedAt.getMonth(), tossedAt.getDate() + 21) : null,
            actualRevenue: isWon ? new Prisma.Decimal(expectedRevenue) : null,
          },
        });

        if (isWon) {
          // 紹介利益（顧客LTV・催事最終LTV利益に反映される）
          await prisma.revenue.create({
            data: {
              organizationId,
              sourceType: 'TOSSUP',
              tossupId: tossup.id,
              customerId: customer.id,
              productId: upsellProductId,
              agencyId: agency.id,
              eventId: event?.id ?? null,
              recognizedOn: new Date(tossedAt.getFullYear(), tossedAt.getMonth(), tossedAt.getDate() + 21),
              amount: new Prisma.Decimal(referralFee),
              referralFee: new Prisma.Decimal(referralFee),
              grossProfit: new Prisma.Decimal(referralFee),
              grossMargin: new Prisma.Decimal(1),
              note: '太陽光/蓄電池 紹介料',
            },
          });
        }
      }
    }
  }

  return { agencies, events };
}
