'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/client/api';
import { errorMessage } from '@/lib/client/errors';
import { Button, Field, Input } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState<{ devLink?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.auth.forgotPassword(email);
      setSent({ devLink: r.dev_reset_link });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">Check your email</h1>
        <p className="text-sm text-slate-600">If an account exists for {email}, a link to reset your password is on its way.</p>
        {sent.devLink && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Development only:{' '}
            <a className="underline" href={sent.devLink}>
              open the reset link
            </a>
          </p>
        )}
        <Link href="/login" className="text-sm text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">Reset your password</h1>
        <p className="mt-2 text-[15px] text-slate-500">We’ll email you a reset link.</p>
      </div>
      <Field label="Email">{(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="h-11 w-full text-[15px]" loading={busy}>
        Send reset link
      </Button>
      <p className="pt-2 text-sm">
        <Link href="/login" className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
