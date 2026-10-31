'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api } from '@/lib/client/api';
import { errorMessage } from '@/lib/client/errors';
import { Button, Field, PasswordInput } from '@/components/ui';
import { PasswordRules, passwordOk } from '@/components/shell/password-rules';

// Opened from the reset / set-password email (?token_hash=…). The server checks the token and the
// password rule, sets the password with the admin API, then signs the user in.
function ResetForm() {
  const router = useRouter();
  const tokenHash = useSearchParams().get('token_hash') ?? undefined;
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { user } = await api.auth.resetPassword(password, tokenHash);
      router.replace(user?.role === 'customer' ? '/portal' : '/app');
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="font-display text-[34px] leading-tight font-semibold tracking-[-0.02em] text-slate-900">Choose a new password</h1>
      {!tokenHash && <p className="text-sm text-slate-500">You’re changing the password of the account you’re signed in to.</p>}
      <Field label="New password">
        {(id) => (
          <>
            <PasswordInput id={id} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordRules value={password} />
          </>
        )}
      </Field>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      <Button type="submit" className="h-11 w-full text-[15px]" loading={busy} disabled={!passwordOk(password)}>
        Save password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
