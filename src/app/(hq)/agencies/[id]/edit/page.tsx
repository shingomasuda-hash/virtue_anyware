import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/data/page-header';
import { AgencyForm } from '@/features/agencies/components/agency-form';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { findAgencyById } from '@/server/repositories/agency.repo';

function toDateInput(value: Date | null): string {
  if (!value) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export default async function EditAgencyPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'agency:write');
  const { id } = await params;
  const agency = await findAgencyById(ctx, id);
  if (!agency) notFound();

  return (
    <>
      <PageHeader title={`${agency.name} を編集`} description="変更内容は監査ログに記録されます。" />
      <AgencyForm
        mode="edit"
        defaults={{
          id: agency.id,
          code: agency.code,
          name: agency.name,
          corporateName: agency.corporateName,
          contactPerson: agency.contactPerson,
          phone: agency.phone,
          email: agency.email,
          postalCode: agency.postalCode,
          prefecture: agency.prefecture,
          city: agency.city,
          address: agency.address,
          building: agency.building,
          contractStartDate: toDateInput(agency.contractStartDate),
          contractEndDate: toDateInput(agency.contractEndDate),
          status: agency.status,
          paymentTerms: agency.paymentTerms,
          bankName: agency.bankName,
          bankBranch: agency.bankBranch,
          bankAccountType: agency.bankAccountType,
          bankAccountNumber: agency.bankAccountNumber,
          bankAccountHolder: agency.bankAccountHolder,
          notes: agency.notes,
        }}
      />
    </>
  );
}
