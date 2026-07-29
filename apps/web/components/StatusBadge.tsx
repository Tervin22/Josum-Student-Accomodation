import clsx from 'clsx';
import type { ApplicationStatus } from '@/lib/types';

const statusClass: Record<ApplicationStatus, string> = {
  SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
  UNDER_REVIEW: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  WAITLISTED: 'bg-sky-50 text-sky-700 border-sky-200',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
  MOVED_OUT: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={clsx('inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold', statusClass[status])}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
