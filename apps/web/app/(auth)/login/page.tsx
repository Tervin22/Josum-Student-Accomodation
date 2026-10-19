'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  KeyRound,
  LogIn,
  MapPin,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import { api, AuthSession, clearSession, saveSession } from '@/lib/api';
import { AUTH_HERO_IMAGE_URL, BRAND_LOGO_URL, BRAND_NAME } from '@/lib/brand';
import { dashboardPathForRoles, hasAnyRole, staffRoles } from '@/lib/role-routing';
import { useToast } from '@/components/ToastProvider';

type Portal = 'student' | 'admin';
type LoginPortalEventDetail = { portal?: Portal; bootstrap?: boolean };

const staffRegistrationRoles = [
  ['MANAGER', 'Manager'],
  ['SECURITY', 'Security'],
  ['TECHNICIAN', 'Technician'],
] as const;
const strongPasswordPattern = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{12,128}';
const strongPasswordTitle = 'Use 12 to 128 characters with uppercase, lowercase, number, and special character';
const phonePattern = '[0-9+()\\-\\s]{7,20}';

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [activePortal, setActivePortal] = useState<Portal | null>(null);
  const [bootstrapOpen, setBootstrapOpen] = useState(false);
  const [staffRegisterOpen, setStaffRegisterOpen] = useState(false);

  useEffect(() => {
    const applyQueryState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reset') === 'success') {
        toast.success('System restored to its initial state');
      }
      openRequestedPortal(params.get('portal'), params.get('bootstrap') === '1');
    };
    const handleLoginPortal = (event: Event) => {
      const detail = (event as CustomEvent<LoginPortalEventDetail>).detail;
      openRequestedPortal(detail?.portal, Boolean(detail?.bootstrap));
    };

    applyQueryState();
    window.addEventListener('popstate', applyQueryState);
    window.addEventListener('josum:open-login-portal', handleLoginPortal);
    return () => {
      window.removeEventListener('popstate', applyQueryState);
      window.removeEventListener('josum:open-login-portal', handleLoginPortal);
    };
  }, [toast]);

  function openRequestedPortal(portal: string | null | undefined, bootstrap: boolean) {
    if (portal === 'student' || portal === 'admin') {
      setActivePortal(portal);
      setBootstrapOpen(portal === 'admin' && bootstrap);
    } else if (bootstrap) {
      setActivePortal('admin');
      setBootstrapOpen(true);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>, portal: Portal) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = await api<AuthSession>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      if (portal === 'admin' && !hasAnyRole(session.user.roles, staffRoles)) {
        clearSession();
        toast.error('Use a registered staff account');
        return;
      }
      if (portal === 'student' && !session.user.roles.includes('STUDENT')) {
        clearSession();
        toast.error('Use the staff login');
        return;
      }
      saveSession(session);
      toast.success('Signed in');
      const residenceId = new URLSearchParams(window.location.search).get('residenceId');
      const studentDestination = residenceId
        ? `/student/dashboard?tab=apply&residenceId=${encodeURIComponent(residenceId)}`
        : '/student/dashboard';
      router.replace(dashboardPathForRoles(session.user.roles, studentDestination));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setLoading(false);
    }
  }

  async function registerStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = await api<AuthSession>('/auth/register-staff', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('staffEmail'),
          password: form.get('staffPassword'),
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          phone: form.get('phone') || undefined,
          role: form.get('role'),
          registrationKey: form.get('registrationKey'),
        }),
      });
      saveSession(session);
      toast.success('Staff account created');
      router.replace(dashboardPathForRoles(session.user.roles));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create staff account');
    } finally {
      setLoading(false);
    }
  }

  async function bootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const session = await api<AuthSession>('/auth/bootstrap-admin', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('adminEmail'),
          password: form.get('adminPassword'),
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          phone: form.get('phone'),
          jobTitle: form.get('jobTitle'),
          bootstrapToken: form.get('bootstrapToken'),
        }),
      });
      saveSession(session);
      toast.success('Administrator created');
      router.replace('/admin/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create administrator');
    } finally {
      setLoading(false);
    }
  }

  function openPortal(portal: Portal) {
    setActivePortal(portal);
    setBootstrapOpen(false);
    setStaffRegisterOpen(false);
  }

  return (
    <main
      className="relative min-h-[100dvh] overflow-hidden bg-ink bg-cover bg-center bg-no-repeat text-white"
      style={{
        backgroundImage: `linear-gradient(105deg, rgba(7, 19, 28, 0.88), rgba(7, 19, 28, 0.52) 46%, rgba(7, 19, 28, 0.72)), url(${AUTH_HERO_IMAGE_URL})`,
      }}
    >
      <header className="absolute inset-x-0 top-0 z-20 border-b border-white/15 bg-ink/30 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex min-w-0 max-w-[50%] items-center gap-3 sm:max-w-none">
            <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={160} height={44} className="h-11 w-24 shrink-0 object-contain object-left sm:w-32" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold tracking-wide">{BRAND_NAME}</p>
              <p className="truncate text-xs text-white/70">Bedworth Park, Vereeniging</p>
            </div>
          </div>
          <nav className="flex shrink-0 items-center gap-2">
            <Link
              href="/residences"
              className="focus-ring hidden h-10 items-center justify-center rounded-lg px-3 text-sm font-semibold text-white hover:bg-white/10 lg:inline-flex"
            >
              Residences
            </Link>
            <button
              type="button"
              onClick={() => openPortal('student')}
              className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white px-2 text-xs font-semibold text-ink shadow-sm hover:bg-white/90 sm:px-4 sm:text-sm"
            >
              <GraduationCap className="h-4 w-4" />
              Student Login
            </button>
            <button
              type="button"
              onClick={() => openPortal('admin')}
              className="focus-ring hidden h-10 items-center justify-center gap-2 rounded-lg border border-white/45 px-4 text-sm font-semibold text-white hover:bg-white/10 sm:inline-flex"
            >
              <ShieldCheck className="h-4 w-4" />
              Staff Login
            </button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-[100dvh] max-w-7xl content-center px-3 pb-8 pt-28 sm:px-4 sm:pb-10 sm:pt-32">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-sm font-medium text-white/90 backdrop-blur">
            <MapPin className="h-4 w-4" />
            Bedworth Park student accommodation
          </div>
          <h1 className="mt-6 max-w-[18rem] break-words text-3xl font-bold leading-tight min-[420px]:max-w-3xl sm:text-5xl lg:text-6xl">
            Live, learn, and prosper at Josum.
          </h1>
          <p className="mt-5 max-w-[20rem] break-words text-base leading-7 text-white/82 min-[420px]:max-w-2xl sm:text-lg">
            Choose between Josum 1 and Josum 2, apply online, upload your documents, and follow every application update in one place.
          </p>
          <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => openPortal('student')}
              className="focus-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-bold text-white shadow-lg shadow-black/20 hover:bg-teal-700 sm:w-auto"
            >
              Student Login
              <ArrowRight className="h-4 w-4" />
            </button>
            <Link
              href="/residences"
              className="focus-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur hover:bg-white/20 sm:w-auto"
            >
              Explore residences
              <Building2 className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => openPortal('admin')}
              className="focus-ring inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-5 text-sm font-bold text-white backdrop-blur hover:bg-white/20 sm:w-auto"
            >
              Staff Login
              <ShieldCheck className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-3 text-sm text-white/90 sm:mt-12 sm:grid-cols-3">
          {[
            ['Two residences, one application', 'Compare Josum 1 and Josum 2 before choosing where to apply.'],
            ['Digital documents', 'Students can attach supporting files to applications.'],
            ['Status notifications', 'Applicants receive email updates as applications move.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-lg border border-white/18 bg-white/10 p-4 backdrop-blur">
              <CheckCircle2 className="h-5 w-5 text-teal-200" />
              <p className="mt-3 font-semibold text-white">{title}</p>
              <p className="mt-1 leading-6 text-white/75">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {activePortal && (
        <div className="fixed inset-0 z-50 grid items-end bg-ink/70 px-3 py-4 backdrop-blur-sm sm:place-items-center sm:px-4 sm:py-6">
          <section className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-white/30 bg-white p-4 text-ink shadow-2xl sm:max-h-[92vh] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-teal-50 text-brand">
                  {activePortal === 'student' ? <GraduationCap className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                </div>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold">{activePortal === 'student' ? 'Student Login' : 'Staff Login'}</h2>
                  <p className="truncate text-sm text-slate-500">{BRAND_NAME}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePortal(null)}
                className="focus-ring grid h-9 w-9 place-items-center rounded-lg border border-line text-slate-600 hover:bg-slate-50"
                aria-label="Close"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activePortal === 'student' && (
              <>
                <form onSubmit={(event) => login(event, 'student')} className="mt-6 grid gap-4">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Email
                    <input name="email" type="email" required className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Password
                    <input name="password" type="password" required className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                  <button
                    disabled={loading}
                    className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </button>
                </form>
                <div className="mt-5 grid gap-3 text-sm sm:flex sm:flex-wrap sm:items-center">
                  <Link href="/register" className="inline-flex items-center gap-2 font-semibold text-accent hover:underline">
                    <UserPlus className="h-4 w-4" />
                    Create student account
                  </Link>
                  <Link href="/forgot-password?portal=student" className="font-medium text-slate-600 hover:underline">
                    Forgot password
                  </Link>
                </div>
              </>
            )}

            {activePortal === 'admin' && !bootstrapOpen && !staffRegisterOpen && (
              <>
                <form onSubmit={(event) => login(event, 'admin')} className="mt-6 grid gap-4">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Staff email
                    <input name="email" type="email" required className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Password
                    <input name="password" type="password" required className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                  <button
                    disabled={loading}
                    className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Sign in to staff dashboard
                  </button>
                </form>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/forgot-password?portal=staff"
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                  >
                    <KeyRound className="h-4 w-4 text-brand" />
                    Forgot staff password
                  </Link>
                  <button
                    type="button"
                    onClick={() => setStaffRegisterOpen(true)}
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                  >
                    <UserPlus className="h-4 w-4 text-brand" />
                    Create manager, security, or technician
                  </button>
                  <button
                    type="button"
                    onClick={() => setBootstrapOpen(true)}
                    className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
                  >
                    <KeyRound className="h-4 w-4 text-brand" />
                    First administrator
                  </button>
                </div>
              </>
            )}

            {activePortal === 'admin' && staffRegisterOpen && (
              <form onSubmit={registerStaff} className="mt-6 grid gap-4">
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-950">
                  Staff accounts require the matching registration key configured by the system owner.
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    First name
                    <input name="firstName" required maxLength={80} className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Last name
                    <input name="lastName" required maxLength={80} className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Role
                  <select name="role" required defaultValue="MANAGER" className="focus-ring h-11 rounded-lg border border-line bg-white px-3">
                    {staffRegistrationRoles.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Staff email
                  <input name="staffEmail" type="email" required maxLength={254} className="focus-ring h-11 rounded-lg border border-line px-3" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Phone
                  <input
                    name="phone"
                    type="tel"
                    pattern={phonePattern}
                    maxLength={20}
                    title="Enter a valid phone number"
                    className="focus-ring h-11 rounded-lg border border-line px-3"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Staff password
                  <input
                    name="staffPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    pattern={strongPasswordPattern}
                    title={strongPasswordTitle}
                    className="focus-ring h-11 rounded-lg border border-line px-3"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Registration key
                  <input name="registrationKey" type="password" required maxLength={256} className="focus-ring h-11 rounded-lg border border-line px-3" />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={loading}
                    className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create staff account
                  </button>
                  <button
                    type="button"
                    onClick={() => setStaffRegisterOpen(false)}
                    className="focus-ring inline-flex h-11 w-full items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                  >
                    Back to staff login
                  </button>
                </div>
              </form>
            )}

            {activePortal === 'admin' && bootstrapOpen && (
              <form onSubmit={bootstrap} className="mt-6 grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    First name
                    <input name="firstName" required className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Last name
                    <input name="lastName" required className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Admin email
                  <input name="adminEmail" type="email" required className="focus-ring h-11 rounded-lg border border-line px-3" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Phone
                    <input
                      name="phone"
                      type="tel"
                      required
                      pattern={phonePattern}
                      maxLength={20}
                      title="Enter a valid phone number"
                      className="focus-ring h-11 rounded-lg border border-line px-3"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Job title
                    <input name="jobTitle" required maxLength={120} className="focus-ring h-11 rounded-lg border border-line px-3" />
                  </label>
                </div>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Admin password
                  <input
                    name="adminPassword"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    pattern={strongPasswordPattern}
                    title={strongPasswordTitle}
                    className="focus-ring h-11 rounded-lg border border-line px-3"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Admin token
                  <input name="bootstrapToken" required className="focus-ring h-11 rounded-lg border border-line px-3" />
                </label>
                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={loading}
                    className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                  >
                    <KeyRound className="h-4 w-4" />
                    Create administrator
                  </button>
                  <button
                    type="button"
                    onClick={() => setBootstrapOpen(false)}
                    className="focus-ring inline-flex h-11 w-full items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                  >
                    Back to login
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
