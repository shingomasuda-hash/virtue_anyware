import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/data/page-header';
import { isAgencyScoped, type AccessContext } from '@/server/authz/context';
import { findDealById, getDealFormOptions } from '@/server/services/deals/repo';
import { DealForm, type DealFormDefaults, type DealFormOptions } from './components/deal-form';

export function toDateInput(value: Date | null | undefined): string {
  if (!value) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function toOptions(raw: Awaited<ReturnType<typeof getDealFormOptions>>): DealFormOptions {
  return {
    statuses: raw.statuses.map((s) => ({ id: s.id, name: s.label })),
    agencies: raw.agencies.map((a) => ({ id: a.id, name: a.name })),
    staff: raw.staff.map((s) => ({ id: s.id, name: s.name })),
    manufacturers: raw.manufacturers.map((m) => ({ id: m.id, name: m.name, categories: m.categories })),
    batteryModels: raw.batteryModels.map((m) => ({
      id: m.id,
      name: m.name,
      capacity: m.capacity === null ? null : String(Number(m.capacity)),
    })),
    financeCompanies: raw.financeCompanies.map((f) => ({ id: f.id, name: f.name })),
    customers: raw.customers.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      externalCustomerId: c.externalCustomerId,
    })),
  };
}

export async function DealFormPage({
  ctx,
  dealId,
  basePath,
}: {
  ctx: AccessContext;
  dealId?: string;
  basePath: string;
}) {
  const options = toOptions(await getDealFormOptions(ctx));
  const showAgencyField = !isAgencyScoped(ctx);

  if (!dealId) {
    const defaultStatus = options.statuses[0];
    return (
      <>
        <PageHeader title="案件を登録" description="アポ取得時点から登録し、進捗に応じてステータスを進めます。" />
        <DealForm
          mode="create"
          defaults={{ statusId: defaultStatus?.id, priority: 'MEDIUM', productTypes: [] }}
          options={options}
          basePath={basePath}
          showAgencyField={showAgencyField}
        />
      </>
    );
  }

  const deal = await findDealById(ctx, dealId);
  if (!deal) notFound();

  const defaults: DealFormDefaults = {
    id: deal.id,
    code: deal.code,
    customerId: deal.customerId,
    agencyId: deal.agencyId,
    statusId: deal.statusId,
    closerStaffId: deal.closerStaffId,
    appointerStaffId: deal.appointerStaffId,
    productTypes: deal.productTypes,
    pvManufacturerId: deal.pvManufacturerId,
    pvCapacityKw: deal.pvCapacityKw === null ? '' : String(Number(deal.pvCapacityKw)),
    batteryManufacturerId: deal.batteryManufacturerId,
    batteryModelId: deal.batteryModelId,
    batteryCapacityKwh: deal.batteryCapacityKwh === null ? '' : String(Number(deal.batteryCapacityKwh)),
    equipmentManufacturerId: deal.equipmentManufacturerId,
    metAt: toDateInput(deal.metAt),
    contractedAt: toDateInput(deal.contractedAt),
    salesPriceExclTax: deal.salesPriceExclTax === null ? '' : String(Number(deal.salesPriceExclTax)),
    paymentMethod: deal.paymentMethod,
    financeCompanyId: deal.financeCompanyId,
    lostReason: deal.lostReason,
    nextActionAt: toDateInput(deal.nextActionAt),
    priority: deal.priority,
    notes: deal.notes,
  };

  return (
    <>
      <PageHeader title={`${deal.code} を編集`} description={deal.customer.name} />
      <DealForm mode="edit" defaults={defaults} options={options} basePath={basePath} showAgencyField={showAgencyField} />
    </>
  );
}
