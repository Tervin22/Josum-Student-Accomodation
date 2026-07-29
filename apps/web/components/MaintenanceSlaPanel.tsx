'use client';

import { useEffect, useState } from 'react';
import {
  formatMaintenanceSlaStatus,
  formatSlaCountdown,
  formatSlaDate,
  maintenanceSlaBadgeClass,
  maintenanceSlaStatus,
  maintenanceSlaTarget,
} from '@/lib/maintenance-sla';
import type { MaintenanceRequest } from '@/lib/types';

export function MaintenanceSlaPanel({ request, compact = false }: { request: MaintenanceRequest; compact?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, []);

  const status = maintenanceSlaStatus(request);
  const target = maintenanceSlaTarget(request);
  const timeDisplay = status === 'RESOLVED' ? 'Succeeded' : formatSlaCountdown(target.value, now);
  const owner = request.assignedTechnician
    ? `${request.assignedTechnician.firstName} ${request.assignedTechnician.lastName}`.trim() || request.assignedTechnician.email
    : 'Unassigned';
  const acknowledgedBy = request.acknowledgedBy
    ? `${request.acknowledgedBy.firstName} ${request.acknowledgedBy.lastName}`.trim() || request.acknowledgedBy.email
    : null;

  return (
    <div className={compact ? 'grid gap-1.5 text-xs' : 'grid gap-2 rounded-lg border border-line bg-slate-50 p-3 text-xs'}>
      <span className={maintenanceSlaBadgeClass(status)}>{formatMaintenanceSlaStatus(status)}</span>
      <div className="grid gap-1 text-slate-600">
        <p><span className="font-semibold text-ink">{target.label}:</span> {formatSlaDate(target.value)}</p>
        <p><span className="font-semibold text-ink">Time:</span> {timeDisplay}</p>
        <p><span className="font-semibold text-ink">Owner:</span> {owner}</p>
        {request.acknowledgedAt && (
          <p>
            <span className="font-semibold text-ink">Acknowledged:</span> {formatSlaDate(request.acknowledgedAt)}
            {acknowledgedBy ? ` by ${acknowledgedBy}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
