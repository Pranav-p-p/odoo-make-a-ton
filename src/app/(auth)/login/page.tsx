'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/client/api';
import { errorMessage } from '@/lib/client/errors';
import { Button, Field, Input, PasswordInput } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const linkError = params.get('error') === 'link_expired' ? 'That link has expired or was already used.' : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(linkError);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.auth.login({ email, password });
      const home = user.role === 'customer' ? '/portal' : '/app';
      const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
      router.replace(safeNext ?? home);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="mb-8">
        <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">Sign in</h1>
        <p className="mt-2 text-[15px] text-slate-500">Use the email your team or account manager registered for you.</p>
      </div>
      <Field label="Email">
        {(id) => (
          <Input id={id} type="email" autoComplete="email" placeholder="you@company.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
        )}
      </Field>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="login-password" className="block text-[13px] font-medium text-slate-700">
            Password
          </label>
          <Link href="/forgot-password" className="text-[13px] font-medium text-brand-600 hover:text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full text-[15px]" loading={busy}>
        Sign in
      </Button>
      <p className="pt-2 text-sm text-slate-500">
        New customer?{' '}
        <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
