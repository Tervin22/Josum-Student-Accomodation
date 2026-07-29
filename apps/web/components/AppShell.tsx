'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { ClipboardList, DoorOpen, LogOut, Settings, UserRound, type LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { clearSession, getSession } from '@/lib/api';
import { BRAND_LOGO_URL, BRAND_NAME } from '@/lib/brand';

const studentNav = [{ href: '/student/dashboard', label: 'Portal', icon: ClipboardList }];
const adminNav = [{ href: '/admin/dashboard', label: 'Admin', icon: Settings }];
const managerNav = [{ href: '/manager/dashboard', label: 'Manager', icon: Settings }];
const securityNav = [{ href: '/security/dashboard', label: 'Security', icon: Settings }];
const technicianNav = [{ href: '/technician/dashboard', label: 'Technician', icon: Settings }];

type AppMode = 'student' | 'admin' | 'manager' | 'security' | 'technician';

export function AppShell({ children, mode }: { children: React.ReactNode; mode: AppMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sessionName, setSessionName] = useState('User');
  const nav = mode === 'student'
    ? studentNav
    : mode === 'manager'
      ? managerNav
      : mode === 'security'
        ? securityNav
        : mode === 'technician'
          ? technicianNav
          : adminNav;

  useEffect(() => {
    const session = getSession();
    setSessionName(session?.user.firstName ?? 'User');
  }, []);

  function logout() {
    clearSession();
    router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Image src={BRAND_LOGO_URL} alt={BRAND_NAME} width={128} height={44} className="h-11 w-24 shrink-0 object-contain object-left" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{BRAND_NAME}</p>
              <p className="text-xs text-slate-500">{modeLabel(mode)}</p>
            </div>
          </div>
          <nav className="hidden items-center gap-2 md:flex">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                    pathname === item.href ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden max-w-40 items-center gap-2 text-sm text-slate-600 sm:flex">
              <UserRound className="h-4 w-4" />
              <span className="truncate">{sessionName}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-white text-slate-600 hover:bg-slate-100"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">{children}</main>
    </div>
  );
}

function modeLabel(mode: AppMode) {
  switch (mode) {
    case 'admin':
      return 'Administration';
    case 'manager':
      return 'Manager dashboard';
    case 'security':
      return 'Security dashboard';
    case 'technician':
      return 'Technician dashboard';
    case 'student':
    default:
      return 'Student portal';
  }
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-40 flex-col items-start gap-4 rounded-lg border border-dashed border-line bg-white p-4 sm:flex-row sm:items-center sm:p-6">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-brand">
        <DoorOpen className="h-6 w-6" />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{body}</p>
      </div>
    </div>
  );
}

export function StatTile({ label, value, icon: Icon }: { label: string; value: string | number; icon: LucideIcon }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium text-slate-500">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-brand" />
      </div>
      <p className="mt-3 break-words text-2xl font-bold leading-tight text-ink">{value}</p>
    </div>
  );
}
