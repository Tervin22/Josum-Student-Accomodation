'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Building2, CheckCircle2, Mail, RefreshCw, Save, Wrench } from 'lucide-react';
import { AppShell, EmptyState, StatTile } from '@/components/AppShell';
import { MaintenanceSlaPanel } from '@/components/MaintenanceSlaPanel';
import { useToast } from '@/components/ToastProvider';
import { api, compactForm, getSession } from '@/lib/api';
import { isMaintenanceSlaBreached } from '@/lib/maintenance-sla';
import { dashboardPathForRoles } from '@/lib/role-routing';
import type { CommunicationRecord, MaintenanceRequest, MaintenanceStatus, Paginated, Residence, ResidenceRoom } from '@/lib/types';

const maintenanceStatuses: MaintenanceStatus[] = ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const communicationTypes = ['POWER_OUTAGE', 'WATER_OUTAGE', 'PLANNED_MAINTENANCE', 'EMERGENCY_MAINTENANCE', 'GENERAL_COMMUNICATION', 'CUSTOM_COMMUNICATION'];

export default function TechnicianDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState<Paginated<MaintenanceRequest>>({ items: [], total: 0, page: 1, limit: 50 });
  const [rooms, setRooms] = useState<ResidenceRoom[]>([]);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [communications, setCommunications] = useState<Paginated<CommunicationRecord>>({ items: [], total: 0, page: 1, limit: 8 });

  async function load() {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!session.user.roles.includes('TECHNICIAN')) {
      router.replace(dashboardPathForRoles(session.user.roles));
      return;
    }

    const [nextMaintenance, nextRooms, nextResidences, nextCommunications] = await Promise.all([
      api<Paginated<MaintenanceRequest>>('/maintenance/admin?page=1&limit=50'),
      api<ResidenceRoom[]>('/residence-rooms'),
      api<Residence[]>('/residences'),
      api<Paginated<CommunicationRecord>>('/communications?page=1&limit=8'),
    ]);
    setMaintenance(nextMaintenance);
    setRooms(nextRooms);
    setResidences(nextResidences);
    setCommunications(nextCommunications);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((error) => {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : 'Could not load technician dashboard');
    });
  }, []);

  async function updateMaintenance(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/maintenance/admin/${id}`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Maintenance request updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update maintenance request');
    }
  }

  async function sendCommunication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/communications', { method: 'POST', body: JSON.stringify(compactForm(form)) });
      toast.success('Communication sent');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send communication');
    }
  }

  if (loading) {
    return (
      <AppShell mode="technician">
        <div className="grid min-h-80 place-items-center text-sm text-slate-500">
          <RefreshCw className="mb-3 h-5 w-5 animate-spin text-brand" />
          Loading
        </div>
      </AppShell>
    );
  }

  const openRequests = maintenance.items.filter((item) => ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(item.status));
  const urgentRequests = maintenance.items.filter((item) => item.priority === 'URGENT' || item.priority === 'HIGH');
  const slaBreachedRequests = maintenance.items.filter(isMaintenanceSlaBreached);
  const resolvedRequests = maintenance.items.filter((item) => item.status === 'RESOLVED' || item.status === 'CLOSED');
  const maintenanceRooms = rooms.filter((room) => room.status === 'MAINTENANCE');

  return (
    <AppShell mode="technician">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Technician Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Maintenance queue, room issues, and resolution updates.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label="Open requests" value={openRequests.length} icon={Wrench} />
        <StatTile label="High priority" value={urgentRequests.length} icon={AlertTriangle} />
        <StatTile label="SLA breached" value={slaBreachedRequests.length} icon={AlertTriangle} />
        <StatTile label="Resolved / closed" value={resolvedRequests.length} icon={CheckCircle2} />
        <StatTile label="Rooms in maintenance" value={maintenanceRooms.length} icon={Building2} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Maintenance Queue</h2>
          <div className="mt-4 grid gap-3">
            {maintenance.items.map((request) => (
              <form key={request.id} onSubmit={(event) => updateMaintenance(event, request.id)} className="grid gap-3 rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{request.title}</p>
                    <p className="mt-1 text-slate-500">
                      {request.referenceCode} - {formatEnum(request.category)} - {request.roomType?.roomTypeName ?? 'No room type'}
                    </p>
                    {request.location && <p className="mt-1 text-slate-500">Location: {request.location}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={badgeClass(request.priority)}>{formatEnum(request.priority)}</span>
                    <span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(request.status)}</span>
                  </div>
                </div>
                <p className="text-slate-600">{request.description}</p>
                <MaintenanceSlaPanel request={request} />
                <div className="grid gap-2 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
                  <select
                    name="status"
                    defaultValue={maintenanceStatuses.includes(request.status) ? request.status : 'ACKNOWLEDGED'}
                    className="focus-ring h-10 rounded-lg border border-line px-2"
                  >
                    {maintenanceStatuses.map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
                  </select>
                  <input name="resolutionNote" defaultValue={request.resolutionNote ?? ''} placeholder="Resolution note" className="focus-ring h-10 rounded-lg border border-line px-2" />
                  <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 font-semibold hover:bg-slate-50">
                    <Save className="h-4 w-4" />
                    Save
                  </button>
                </div>
              </form>
            ))}
            {!maintenance.items.length && <EmptyState title="No maintenance requests" body="Assigned residence maintenance requests will appear here." />}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Rooms Marked Maintenance</h2>
          <div className="mt-4 grid gap-3">
            {maintenanceRooms.map((room) => (
              <div key={room.id} className="rounded-lg border border-line p-3 text-sm">
                <p className="font-semibold text-ink">{room.name}</p>
                <p className="mt-1 text-slate-500">{room.genderAllocation} - {room.roomTypeName}</p>
                <span className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                  {formatEnum(room.status)}
                </span>
              </div>
            ))}
            {!maintenanceRooms.length && <EmptyState title="No maintenance rooms" body="Rooms marked for maintenance will appear here." />}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <form onSubmit={sendCommunication} className="grid gap-4">
            <div>
              <h2 className="font-semibold text-ink">Resident Communication</h2>
              <p className="mt-1 text-sm text-slate-500">Send maintenance notices to active residents only.</p>
            </div>
            <label className="grid gap-1 text-sm font-medium text-ink">
              Type
              <select name="type" required className="focus-ring h-10 rounded-lg border border-line px-2">
                {communicationTypes.map((type) => <option key={type} value={type}>{formatEnum(type)}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              Accommodation
              <select name="residenceId" className="focus-ring h-10 rounded-lg border border-line px-2">
                <option value="">Both accommodations</option>
                {residences.map((residence) => <option key={residence.id} value={residence.id}>{residence.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              Subject
              <input name="subject" required maxLength={160} className="focus-ring h-10 rounded-lg border border-line px-3" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              Message
              <textarea name="message" required rows={5} className="focus-ring rounded-lg border border-line px-3 py-2" />
            </label>
            <button className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white sm:w-auto">
              <Mail className="h-4 w-4" />
              Send communication
            </button>
          </form>

          <div>
            <h3 className="font-semibold text-ink">Communication History</h3>
            <div className="mt-4 grid gap-3">
              {communications.items.map((item) => (
                <div key={item.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="font-semibold text-ink">{item.subject}</p>
                    <span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(item.type)}</span>
                  </div>
                  <p className="mt-2 text-slate-600">{item.message}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.residence?.name ?? 'Both accommodations'} - {item.successCount}/{item.recipientCount} delivered - {formatDateTime(item.createdAt)}
                  </p>
                </div>
              ))}
              {!communications.items.length && <EmptyState title="No communications" body="Maintenance communications will appear here after they are sent." />}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function badgeClass(priority: string) {
  const base = 'rounded-full border px-2 py-1 text-xs font-semibold';
  if (priority === 'URGENT') return `${base} border-red-200 bg-red-50 text-red-700`;
  if (priority === 'HIGH') return `${base} border-amber-200 bg-amber-50 text-amber-700`;
  return `${base} border-line text-slate-600`;
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '';
}
