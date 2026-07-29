'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { GraduationCap, Mail, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';

const accountRoles = [
  ['STUDENT', 'Student'],
  ['ADMINISTRATOR', 'Administrator'],
  ['MANAGER', 'Manager'],
  ['SECURITY', 'Security'],
  ['TECHNICIAN', 'Technician'],
] as const;

type AccountRole = (typeof accountRoles)[number][0];

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<AccountRole>('STUDENT');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedRole = params.get('role')?.toUpperCase();
    if (isAccountRole(requestedRole)) {
      setRole(requestedRole);
      return;
    }
    if (['staff', 'admin'].includes(params.get('portal') ?? '')) {
      setRole('MANAGER');
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          role: form.get('role'),
        }),
      });
      toast.success('If the email and role match, a reset link has been sent');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  const selectedRoleLabel = accountRoles.find(([value]) => value === role)?.[1] ?? 'account';
  const isStaffRole = role !== 'STUDENT';

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-paper px-3 py-6 sm:px-4">
      <form onSubmit={submit} className="grid w-full max-w-md gap-4 rounded-lg border border-line bg-white p-5 shadow-soft sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-teal-50 text-brand">
            {isStaffRole ? <ShieldCheck className="h-5 w-5" /> : <GraduationCap className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink">Reset password</h1>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Choose the role used when the account was created, then enter that account email.
            </p>
          </div>
        </div>
        <label className="grid gap-1 text-sm font-medium text-ink">
          Account role
          <select
            name="role"
            required
            value={role}
            onChange={(event) => setRole(event.target.value as AccountRole)}
            className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2"
          >
            {accountRoles.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-ink">
          {selectedRoleLabel} email
          <input name="email" type="email" required className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
        </label>
        <button
          disabled={loading}
          className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Mail className="h-4 w-4" />
          Send reset email
        </button>
        <Link href={isStaffRole ? '/login?portal=admin' : '/login?portal=student'} className="text-sm font-medium text-slate-600 hover:underline">
          Back to {isStaffRole ? 'staff' : 'student'} sign in
        </Link>
      </form>
    </main>
  );
}

function isAccountRole(value: string | undefined): value is AccountRole {
  return accountRoles.some(([role]) => role === value);
}
