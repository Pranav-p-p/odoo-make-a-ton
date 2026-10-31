'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api, ApiClientError } from '@/lib/client/api';
import { errorMessage } from '@/lib/client/errors';
import { Button, Field, Input } from '@/components/ui';
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
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Confirm your email</h1>
        <p className="text-sm text-slate-600">
          We sent a link to <b>{done.email}</b>. Open it to finish creating your account.
        </p>
        {done.devLink && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Development only (no email provider set):{' '}
            <a className="underline" href={done.devLink}>
              confirm now
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
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your subscriptions and invoices in one place.</p>
      </div>
      <Field label="Full name" error={fieldErrors.full_name}>
        {(id) => <Input id={id} autoComplete="name" required value={form.full_name} onChange={set('full_name')} />}
      </Field>
      <Field label="Email" error={fieldErrors.email}>
        {(id) => <Input id={id} type="email" autoComplete="email" required value={form.email} onChange={set('email')} />}
      </Field>
      <Field label="Password" error={fieldErrors.password}>
        {(id) => (
          <>
            <Input id={id} type="password" autoComplete="new-password" required value={form.password} onChange={set('password')} />
            <PasswordRules value={form.password} />
          </>
        )}
      </Field>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="w-full" loading={busy} disabled={!passwordOk(form.password)}>
        Create account
      </Button>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/login" className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
