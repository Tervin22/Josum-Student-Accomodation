import type { MaintenanceRequest, MaintenanceSlaStatus } from '@/lib/types';

const activeResolutionStatuses = ['ACKNOWLEDGED', 'IN_PROGRESS'] as const;

export function maintenanceSlaStatus(request: MaintenanceRequest): MaintenanceSlaStatus {
  if (request.status === 'RESOLVED' || request.status === 'CLOSED') return 'RESOLVED';
  if (request.slaStatus) return request.slaStatus;
  if (request.status === 'OPEN') return isPast(request.acknowledgementDeadlineAt) ? 'ACK_BREACHED' : 'ACK_PENDING';
  if (activeResolutionStatuses.includes(request.status as (typeof activeResolutionStatuses)[number])) {
    return isPast(request.resolutionDeadlineAt) ? 'RESOLUTION_BREACHED' : 'RESOLUTION_PENDING';
  }
  return 'ACK_PENDING';
}

export function formatMaintenanceSlaStatus(status: MaintenanceSlaStatus) {
  const labels: Record<MaintenanceSlaStatus, string> = {
    ACK_PENDING: 'Awaiting acknowledgement',
    ACK_BREACHED: 'Acknowledgement breached',
    RESOLUTION_PENDING: 'Resolution in progress',
    RESOLUTION_BREACHED: 'Resolution breached',
    RESOLVED: 'SLA complete',
  };
  return labels[status];
}

export function maintenanceSlaBadgeClass(status: MaintenanceSlaStatus) {
  const base = 'inline-flex w-fit rounded-full border px-2 py-1 text-xs font-semibold';
  if (status === 'ACK_BREACHED' || status === 'RESOLUTION_BREACHED') return `${base} border-red-200 bg-red-50 text-red-700`;
  if (status === 'ACK_PENDING') return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  if (status === 'RESOLUTION_PENDING') return `${base} border-blue-200 bg-blue-50 text-blue-700`;
  return `${base} border-emerald-200 bg-emerald-50 text-emerald-700`;
}

export function maintenanceSlaTarget(request: MaintenanceRequest) {
  if (request.status === 'OPEN') {
    return {
      label: 'Acknowledge by',
      value: request.acknowledgementDeadlineAt,
    };
  }
  if (request.status === 'ACKNOWLEDGED' || request.status === 'IN_PROGRESS') {
    return {
      label: 'Resolve by',
      value: request.resolutionDeadlineAt,
    };
  }
  return {
    label: request.status === 'CLOSED' ? 'Closed' : 'Resolved',
    value: request.resolvedAt,
  };
}

export function formatSlaDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not set';
}

export function formatSlaCountdown(value?: string | null, now = Date.now()) {
  if (!value) return 'No deadline';
  const target = new Date(value).getTime();
  const diffMs = target - now;
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.max(1, Math.ceil(absMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    !days && minutes ? `${minutes}m` : '',
  ].filter(Boolean);
  return `${parts.join(' ') || '0m'} ${diffMs >= 0 ? 'left' : 'overdue'}`;
}

export function isMaintenanceSlaBreached(request: MaintenanceRequest) {
  const status = maintenanceSlaStatus(request);
  return status === 'ACK_BREACHED' || status === 'RESOLUTION_BREACHED';
}

function isPast(value?: string | null) {
  return value ? new Date(value).getTime() <= Date.now() : false;
}
