'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiClientError } from '@/lib/client/api';
import { errorMessage } from '@/lib/client/errors';
import { Button, Field, Input, PasswordInput } from '@/components/ui';
import { PasswordRules, passwordOk } from '@/components/shell/password-rules';

export default function SignupPage() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; devLink?: string } | null>(null);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const r = await api.auth.signup(form);
      setDone({ email: r.email, devLink: r.dev_confirm_link });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'VALIDATION_ERROR') setFieldErrors(err.fieldErrors);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
            <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
            <path d="M3 5.5l7 5 7-5" />
          </svg>
        </div>
        <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">Check your inbox</h1>
        <p className="text-[15px] text-slate-600">
          We sent a confirmation link to <span className="font-medium text-slate-900">{done.email}</span>. Open it to finish creating your
          account.
        </p>
        {done.devLink && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            Development only (no email provider set):{' '}
            <a className="font-medium underline" href={done.devLink}>
              confirm now
            </a>
          </p>
        )}
        <Link href="/login" className="inline-block text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="mb-8">
        <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">Create your account</h1>
        <p className="mt-2 text-[15px] text-slate-500">See your subscriptions, download invoices and keep your details up to date.</p>
      </div>
      <Field label="Full name" error={fieldErrors.full_name}>
        {(id) => <Input id={id} autoComplete="name" required value={form.full_name} onChange={set('full_name')} className="h-11" />}
      </Field>
      <Field label="Email" error={fieldErrors.email}>
        {(id) => (
          <Input id={id} type="email" autoComplete="email" placeholder="you@company.com" required value={form.email} onChange={set('email')} className="h-11" />
        )}
      </Field>
      <Field label="Password" error={fieldErrors.password}>
        {(id) => (
          <>
            <PasswordInput id={id} autoComplete="new-password" required value={form.password} onChange={set('password')} className="h-11" />
            <PasswordRules value={form.password} />
          </>
        )}
      </Field>
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" className="h-11 w-full text-[15px]" loading={busy} disabled={!passwordOk(form.password)}>
        Create account
      </Button>
      <p className="pt-2 text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
