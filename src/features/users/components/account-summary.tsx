import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { ROLE_LABELS } from '@/server/authz/roles';
import type { AccessContext } from '@/server/authz/context';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-[var(--color-ink-subtle)]">{label}</dt>
      <dd className="text-[13px] text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

export function AccountSummary({
  ctx,
  organizationName,
  agencyName,
}: {
  ctx: AccessContext;
  organizationName: string;
  agencyName: string | null;
}) {
  return (
    <Panel>
      <PanelHeader title="ログイン情報" description="氏名・ロール・所属の変更は管理者へ依頼してください。" />
      <PanelBody>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Row label="氏名" value={ctx.name} />
          <Row label="メールアドレス" value={ctx.email} />
          <Row label="ロール" value={ROLE_LABELS[ctx.role]} />
          <Row label={agencyName ? '所属代理店' : '組織'} value={agencyName ?? organizationName} />
        </dl>
      </PanelBody>
    </Panel>
  );
}
