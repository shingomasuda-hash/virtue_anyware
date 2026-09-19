import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/data/page-header';
import { isAgencyScoped, type AccessContext } from '@/server/authz/context';
import { findContractById } from '@/server/repositories/contract.repo';
import { findCustomerById } from '@/server/repositories/customer.repo';
import { listAgencies } from '@/server/repositories/agency.repo';
import { getContractFormOptions } from '@/server/services/contract-write';
import { toNumber } from '@/lib/money';
import { ContractForm, type ContractFormDefaults } from './components/contract-form';

function toDateInput(value: Date | null | undefined): string {
  if (!value) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export async function ContractFormPage({
  ctx,
  contractId,
  customerId,
  basePath,
}: {
  ctx: AccessContext;
  contractId?: string;
  customerId?: string;
  basePath: string;
}) {
  const scoped = isAgencyScoped(ctx);

  const [contract, options, agencies] = await Promise.all([
    contractId ? findContractById(ctx, contractId) : Promise.resolve(null),
    getContractFormOptions(ctx),
    scoped ? Promise.resolve([]) : listAgencies(ctx),
  ]);

  if (contractId && !contract) notFound();

  const targetCustomerId = contract?.customerId ?? customerId;
  if (!targetCustomerId) notFound();

  // 顧客もスコープ内であることを確認（他代理店の顧客に契約を作らせない）
  const customer = await findCustomerById(ctx, targetCustomerId);
  if (!customer) notFound();

  const defaults: ContractFormDefaults = contract
    ? {
        id: contract.id,
        customerId: contract.customerId,
        productId: contract.productId,
        agencyId: contract.agencyId,
        contractNumber: contract.contractNumber,
        supplierId: contract.supplierId,
        planId: contract.planId,
        contractWatt: String(toNumber(contract.contractWatt)),
        statusId: contract.statusId,
        appliedAt: toDateInput(contract.appliedAt),
        contractedAt: toDateInput(contract.contractedAt),
        activatedAt: toDateInput(contract.activatedAt),
        eventId: contract.eventId,
        staffId: contract.staffId,
        campaign: contract.campaign,
        notes: contract.notes,
      }
    : {
        customerId: targetCustomerId,
        productId: options.products[0]?.id,
        statusId: options.statuses[0]?.id,
        contractWatt: '0',
      };

  return (
    <>
      <PageHeader
        title={contract ? `${contract.contractNumber ?? '契約'} を編集` : '契約を登録'}
        description={
          contract
            ? '数量・契約日・代理店・商材を変更した場合のみ単価を再解決します。それ以外は金額を動かしません。'
            : undefined
        }
      />
      <ContractForm
        mode={contract ? 'edit' : 'create'}
        defaults={defaults}
        customerName={customer.name}
        basePath={basePath}
        canChooseAgency={!scoped}
        agencies={agencies.map((a) => ({ value: a.id, label: a.name }))}
        options={{
          products: options.products.map((p) => ({ value: p.id, label: p.name })),
          suppliers: options.suppliers.map((s) => ({ value: s.id, label: s.name })),
          plans: options.plans.map((p) => ({ value: p.id, label: p.name })),
          statuses: options.statuses.map((s) => ({ value: s.id, label: s.label })),
          events: options.events.map((e) => ({ value: e.id, label: e.name })),
          staff: options.staff.map((s) => ({ value: s.id, label: s.name })),
        }}
      />
    </>
  );
}
