import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VIRTUE Sales OS',
  description: '電力販売・代理店管理・催事収益・アップセルCRMを統合した基幹業務システム',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
