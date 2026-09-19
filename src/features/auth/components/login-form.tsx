'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { authClient } from '@/server/auth/client';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      // 原因を明かさない汎用メッセージ（アカウント列挙対策 §31）
      setError('メールアドレスまたはパスワードが正しくありません。');
      setBusy(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="panel flex flex-col gap-4 p-5">
      <h1 className="text-[15px] font-semibold">ログイン</h1>

      <Field label="メールアドレス" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>

      <Field label="パスワード" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-[var(--radius-sm)] border border-[#fecdca] bg-[var(--color-negative-soft)] px-2.5 py-2 text-[12px] text-[var(--color-negative)]">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="primary" size="lg" disabled={busy}>
        {busy ? 'ログイン中…' : 'ログイン'}
      </Button>
    </form>
  );
}
