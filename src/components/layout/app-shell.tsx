import * as React from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import type { NavSection } from './nav-config';

/**
 * 基本レイアウト（§29）: 左サイドバー + 上部ヘッダー + メインコンテンツ。
 * PC 業務利用を最優先し、タブレット以下ではサイドバーを上部へ折り返す。
 */
export function AppShell({
  sections,
  organizationName,
  userName,
  roleLabel,
  agencyName,
  children,
}: {
  sections: NavSection[];
  organizationName: string;
  userName: string;
  roleLabel: string;
  agencyName: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="w-full shrink-0 lg:h-screen lg:w-60 lg:sticky lg:top-0">
        <Sidebar sections={sections} organizationName={organizationName} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Header userName={userName} roleLabel={roleLabel} agencyName={agencyName} />
        <main className="flex-1 px-4 py-5 lg:px-6">
          <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">{children}</div>
        </main>
      </div>
    </div>
  );
}
