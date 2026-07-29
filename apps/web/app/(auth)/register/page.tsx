'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { api, AuthSession, compactForm, saveSession } from '@/lib/api';
import { AUTH_HERO_IMAGE_URL, BRAND_LOGO_URL, BRAND_NAME } from '@/lib/brand';
import { useToast } from '@/components/ToastProvider';

const strongPasswordPattern = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,128}';
const strongPasswordTitle = 'Use 12 to 128 characters with uppercase, lowercase, number, and special character';
const phonePattern = '[0-9+()\\-\\s]{7,20}';

function dateOfBirthFromSouthAfricanId(idNumber: string) {
  const digits = idNumber.replace(/\D/g, '');
  if (!/^\d{13}$/.test(digits)) return '';

  const year = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const day = Number(digits.slice(4, 6));
  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentYearLastTwoDigits = currentYear % 100;
  const fullYear = year <= currentYearLastTwoDigits ? currentCentury + year : currentCentury - 100 + year;
  const parsed = new Date(Date.UTC(fullYear, month - 1, day));

  if (parsed.getUTCFullYear() !== fullYear || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return '';
  }

  return `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [idNumber, setIdNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');

  function updateIdNumber(event: ChangeEvent<HTMLInputElement>) {
    const nextIdNumber = event.target.value.replace(/\D/g, '').slice(0, 13);
    setIdNumber(nextIdNumber);
    const nextDateOfBirth = dateOfBirthFromSouthAfricanId(nextIdNumber);
    if (nextDateOfBirth) setDateOfBirth(nextDateOfBirth);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = await api<AuthSession>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(compactForm(form)),
      });
      saveSession(session);
      toast.success('Student account created');
      router.replace('/student/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-[100dvh] bg-ink bg-cover bg-center bg-no-repeat px-3 py-4 sm:px-4 sm:py-8"
      style={{
        backgroundImage: `linear-gradient(115deg, rgba(9, 23, 36, 0.84), rgba(9, 23, 36, 0.58) 48%, rgba(9, 23, 36, 0.74)), url(${AUTH_HERO_IMAGE_URL})`,
      }}
    >
      <form onSubmit={submit} className="mx-auto grid w-full max-w-3xl gap-5 rounded-lg border border-white/30 bg-white/95 p-4 shadow-soft backdrop-blur sm:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={48} height={48} className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-ink">Student registration</h1>
            <p className="mt-1 truncate text-sm text-slate-500">{BRAND_NAME}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { name: 'firstName', label: 'First name', type: 'text' },
            { name: 'lastName', label: 'Last name', type: 'text' },
            { name: 'email', label: 'Email', type: 'email' },
            { name: 'phone', label: 'Phone', type: 'tel' },
            { name: 'password', label: 'Password', type: 'password' },
            { name: 'studentNumber', label: 'Student number', type: 'text' },
            { name: 'institution', label: 'Institution', type: 'text' },
            { name: 'course', label: 'Course', type: 'text' },
            { name: 'yearOfStudy', label: 'Year of study', type: 'number' },
            { name: 'idNumber', label: 'ID number', type: 'text' },
            { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
          ].map((field) => {
            const isIdNumber = field.name === 'idNumber';
            const isDateOfBirth = field.name === 'dateOfBirth';
            const isYear = field.name === 'yearOfStudy';
            const isPassword = field.name === 'password';
            const isPhone = field.name === 'phone';
            return (
              <label key={field.name} className="grid gap-1 text-sm font-medium text-ink">
                {field.label}
                <input
                  name={field.name}
                  type={field.type}
                  required
                  pattern={isPassword ? strongPasswordPattern : isIdNumber ? '\\d{13}' : isPhone ? phonePattern : undefined}
                  inputMode={isIdNumber ? 'numeric' : undefined}
                  value={isIdNumber ? idNumber : isDateOfBirth ? dateOfBirth : undefined}
                  onChange={isIdNumber ? updateIdNumber : isDateOfBirth ? (event) => setDateOfBirth(event.target.value) : undefined}
                  minLength={isPassword ? 12 : isIdNumber ? 13 : undefined}
                  maxLength={isPassword ? 128 : isIdNumber ? 13 : field.name === 'email' ? 254 : 120}
                  min={isYear ? 1 : undefined}
                  max={isYear ? 10 : undefined}
                  title={
                    isPassword
                      ? strongPasswordTitle
                      : isIdNumber
                        ? 'Enter a valid South African ID number with 13 digits'
                        : isPhone
                          ? 'Enter a valid phone number'
                          : undefined
                  }
                  className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2"
                />
              </label>
            );
          })}
        </div>
        <label className="grid gap-1 text-sm font-medium text-ink">
          Address
          <textarea name="address" rows={3} required className="focus-ring w-full rounded-lg border border-line px-3 py-2" />
        </label>
        <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <button
            disabled={loading}
            className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
          >
            <UserPlus className="h-4 w-4" />
            Register
          </button>
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </main>
  );
}
