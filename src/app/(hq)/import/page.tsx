import { StepNav } from '@/features/import/components/step-nav';
import { UploadForm } from '@/features/import/components/upload-form';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function ImportUploadPage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'import:run');
  return (
    <>
      <StepNav current={1} />
      <UploadForm />
    </>
  );
}
