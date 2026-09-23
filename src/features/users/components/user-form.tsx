'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { describePasswordPolicy } from '@/lib/password';
import { ROLE_LABELS } from '@/server/authz/roles';
import type { UserRole } from '@/generated/prisma';
import { createUserAction, updateUserAction } from '../actions';

export interface UserFormDefaults {
  id?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  agencyId?: string | null;
  phone?: string | null;
  isActive?: boolean;
}

export interface AgencyOption {
  id: string;
  name: string;
  code: string;
}

const AGENCY_ROLES: readonly UserRole[] = ['AGENCY_ADMIN', 'AGENCY_STAFF'];

type State = ActionResult<{ id: string }> | null;

export function UserForm({
  mode,
  defaults,
  agencies,
  assignableRoles,
}: {
  mode: 'create' | 'edit';
  defaults: UserFormDefaults;
  agencies: AgencyOption[];
  assignableRoles: UserRole[];
}) {
  const router = useRouter();
  const action = mode === 'create' ? createUserAction : updateUserAction;
  const [role, setRole] = useState<UserRole>(defaults.role ?? 'HQ_STAFF');
  const [state, formAction] = useActionState<State, FormData>(
    async (prev, formData) => (await action(prev, formData)) as State,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push('/users');
      router.refresh();
    }
  }, [state, router]);

  const needsAgency = AGENCY_ROLES.includes(role);

  return (
    <form action={formAction}>
      {mode === 'edit' && defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Panel>
        <PanelHeader
          title={mode === 'create' ? 'ユーザーを登録' : 'ユーザーを編集'}
          description={
            mode === 'create'
              ? '初期パスワードは管理者が本人へ安全な方法で伝え、本人にアカウント設定から変更してもらってください。'
              : undefined
          }
        />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="氏名 *">
              <Input name="name" required defaultValue={defaults.name ?? ''} />
              <FieldError state={state} name="name" />
            </Field>
            <Field label="メールアドレス *" hint="ログイン ID になります">
              <Input name="email" type="email" required defaultValue={defaults.email ?? ''} />
              <FieldError state={state} name="email" />
            </Field>

            <Field label="ロール *">
              <Select name="role" required value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                {assignableRoles.map((value) => (
                  <option key={value} value={value}>
                    {ROLE_LABELS[value]}
                  </option>
                ))}
              </Select>
              <FieldError state={state} name="role" />
            </Field>
            <Field
              label={needsAgency ? '所属代理店 *' : '所属代理店'}
              hint={needsAgency ? '代理店ロールでは必須です' : '本部ロールでは設定されません'}
            >
              <Select name="agencyId" defaultValue={defaults.agencyId ?? ''} disabled={!needsAgency}>
                <option value="">（未選択）</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.code} / {agency.name}
                  </option>
                ))}
              </Select>
              <FieldError state={state} name="agencyId" />
            </Field>

            <Field label="電話番号">
              <Input name="phone" inputMode="tel" defaultValue={defaults.phone ?? ''} />
            </Field>
            <Field label="状態 *" hint="無効にすると即座にログインできなくなり、既存セッションも失効します">
              <Select name="isActive" required defaultValue={(defaults.isActive ?? true) ? 'true' : 'false'}>
                <option value="true">有効</option>
                <option value="false">無効</option>
              </Select>
            </Field>
          </div>

          {mode === 'create' ? (
            <div className="grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2">
              <Field label="初期パスワード *" hint={describePasswordPolicy()}>
                <Input name="password" type="password" required autoComplete="new-password" />
                <FieldError state={state} name="password" />
              </Field>
              <Field label="初期パスワード（確認） *">
                <Input name="passwordConfirm" type="password" required autoComplete="new-password" />
                <FieldError state={state} name="passwordConfirm" />
              </Field>
            </div>
          ) : null}

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <SubmitButton>{mode === 'create' ? '登録する' : '保存する'}</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              キャンセル
            </Button>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}
