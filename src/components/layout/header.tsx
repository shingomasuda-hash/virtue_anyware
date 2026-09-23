'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/server/auth/client';

export function Header({
  userName,
  roleLabel,
  agencyName,
  accountHref,
}: {
  userName: string;
  roleLabel: string;
  agencyName: string | null;
  accountHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    await authClient.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-white px-4">
      <div className="min-w-0 text-[12px] text-[var(--color-ink-subtle)]">
        {agencyName ? <span className="font-medium text-[var(--color-ink-muted)]">{agencyName}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={accountHref}
          className="hidden text-right sm:block hover:underline"
          title="アカウント設定"
        >
          <p className="text-[12px] font-medium leading-tight">{userName}</p>
          <p className="text-[10px] text-[var(--color-ink-subtle)]">{roleLabel}</p>
        </Link>
        <Button size="sm" variant="secondary" onClick={handleSignOut} disabled={busy}>
          {busy ? '処理中…' : 'ログアウト'}
        </Button>
      </div>
    </header>
  );
}
