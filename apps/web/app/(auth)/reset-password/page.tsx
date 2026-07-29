'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

const strongPasswordPattern = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,128}';
const strongPasswordTitle = 'Use 12 to 128 characters with uppercase, lowercase, number, and special character';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="grid min-h-[100dvh] place-items-center bg-paper px-3 text-sm text-slate-500 sm:px-4">Loading</main>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: form.get('token'),
          password: form.get('password'),
        }),
      });
      toast.success('Password updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-paper px-3 py-6 sm:px-4">
      <form onSubmit={submit} className="grid w-full max-w-md gap-4 rounded-lg border border-line bg-white p-5 shadow-soft sm:p-6">
        <h1 className="text-xl font-bold text-ink">Set new password</h1>
        <input name="token" type="hidden" defaultValue={params.get('token') ?? ''} />
        <label className="grid gap-1 text-sm font-medium text-ink">
          New password
          <input
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            pattern={strongPasswordPattern}
            title={strongPasswordTitle}
            className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2"
          />
        </label>
        <button
          disabled={loading}
          className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" />
          Update password
        </button>
        <Link href="/login" className="text-sm font-medium text-slate-600 hover:underline">
          Back to sign in
        </Link>
      </form>
    </main>
  );
}
