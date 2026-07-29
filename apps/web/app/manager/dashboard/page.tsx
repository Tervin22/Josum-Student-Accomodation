'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Archive, Building2, ClipboardList, Download, Mail, RefreshCw, Save, ShieldCheck, UsersRound, Wrench } from 'lucide-react';
import { AppShell, EmptyState, StatTile } from '@/components/AppShell';
import { MaintenanceSlaPanel } from '@/components/MaintenanceSlaPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/ToastProvider';
import { api, compactForm, downloadFinanceExport, downloadInspectionExport, downloadStorageExport, downloadStorageFile, getSession } from '@/lib/api';
import { isMaintenanceSlaBreached } from '@/lib/maintenance-sla';
import { dashboardPathForRoles } from '@/lib/role-routing';
import type {
  Application,
  ApplicationStatus,
  CommunicationRecord,
  FinanceReportRow,
  Inspection,
  IncidentReport,
  MaintenanceRequest,
  MaintenanceStatus,
  Paginated,
  Residence,
  ResidenceRoom,
  StorageRequest,
  User,
  VisitorLog,
} from '@/lib/types';

type Stats = {
  students: number;
  applications: number;
  pendingApplications: number;
  maintenanceRequests: number;
  openMaintenanceRequests: number;
  documents: number;
  totalRooms: number;
  availableRooms: number;
  residences: Array<Residence & { occupiedRooms: number }>;
};

const applicationStatuses: ApplicationStatus[] = ['UNDER_REVIEW', 'APPROVED', 'WAITLISTED', 'REJECTED', 'CANCELLED'];
const maintenanceStatuses: MaintenanceStatus[] = ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const communicationTypes = ['POWER_OUTAGE', 'WATER_OUTAGE', 'PLANNED_MAINTENANCE', 'EMERGENCY_MAINTENANCE', 'GENERAL_COMMUNICATION', 'CUSTOM_COMMUNICATION'];

export default function ManagerDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [applications, setApplications] = useState<Paginated<Application>>({ items: [], total: 0, page: 1, limit: 10 });
  const [maintenance, setMaintenance] = useState<Paginated<MaintenanceRequest>>({ items: [], total: 0, page: 1, limit: 10 });
  const [students, setStudents] = useState<Paginated<User>>({ items: [], total: 0, page: 1, limit: 10 });
  const [rooms, setRooms] = useState<ResidenceRoom[]>([]);
  const [visitors, setVisitors] = useState<Paginated<VisitorLog>>({ items: [], total: 0, page: 1, limit: 8 });
  const [incidents, setIncidents] = useState<Paginated<IncidentReport>>({ items: [], total: 0, page: 1, limit: 8 });
  const [storageRequests, setStorageRequests] = useState<Paginated<StorageRequest>>({ items: [], total: 0, page: 1, limit: 8 });
  const [financeReport, setFinanceReport] = useState<Paginated<FinanceReportRow>>({ items: [], total: 0, page: 1, limit: 8 });
  const [inspections, setInspections] = useState<Paginated<Inspection>>({ items: [], total: 0, page: 1, limit: 8 });
  const [communications, setCommunications] = useState<Paginated<CommunicationRecord>>({ items: [], total: 0, page: 1, limit: 8 });

  async function load() {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!session.user.roles.includes('MANAGER')) {
      router.replace(dashboardPathForRoles(session.user.roles));
      return;
    }

    const [
      nextStats,
      nextApplications,
      nextMaintenance,
      nextStudents,
      nextRooms,
      nextVisitors,
      nextIncidents,
      nextStorageRequests,
      nextFinanceReport,
      nextInspections,
      nextCommunications,
    ] = await Promise.all([
      api<Stats>('/applications/admin/stats'),
      api<Paginated<Application>>('/applications/admin?page=1&limit=10'),
      api<Paginated<MaintenanceRequest>>('/maintenance/admin?page=1&limit=10'),
      api<Paginated<User>>('/users/students?page=1&limit=10'),
      api<ResidenceRoom[]>('/residence-rooms'),
      api<Paginated<VisitorLog>>('/security/visitors?page=1&limit=8'),
      api<Paginated<IncidentReport>>('/security/incidents?page=1&limit=8'),
      api<Paginated<StorageRequest>>('/storage-requests/admin?page=1&limit=8'),
      api<Paginated<FinanceReportRow>>('/reports/finance?page=1&limit=8'),
      api<Paginated<Inspection>>('/inspections?page=1&limit=8'),
      api<Paginated<CommunicationRecord>>('/communications?page=1&limit=8'),
    ]);
    setStats(nextStats);
    setApplications(nextApplications);
    setMaintenance(nextMaintenance);
    setStudents(nextStudents);
    setRooms(nextRooms);
    setVisitors(nextVisitors);
    setIncidents(nextIncidents);
    setStorageRequests(nextStorageRequests);
    setFinanceReport(nextFinanceReport);
    setInspections(nextInspections);
    setCommunications(nextCommunications);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((error) => {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : 'Could not load manager dashboard');
    });
  }, []);

  async function updateApplication(event: FormEvent<HTMLFormElement>, application: Application) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/applications/admin/${application.id}/status`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Application updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update application');
    }
  }

  async function updateMaintenance(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/maintenance/admin/${id}`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Maintenance updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update maintenance');
    }
  }

  async function updateIncident(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/security/incidents/${id}`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Incident updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update incident');
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
      <AppShell mode="manager">
        <div className="grid min-h-80 place-items-center text-sm text-slate-500">
          <RefreshCw className="mb-3 h-5 w-5 animate-spin text-brand" />
          Loading
        </div>
      </AppShell>
    );
  }

  const slaBreachedRequests = maintenance.items.filter(isMaintenanceSlaBreached);

  return (
    <AppShell mode="manager">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Manager Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Applications, occupancy, students, maintenance, and security operations.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <StatTile label="Pending applications" value={stats?.pendingApplications ?? 0} icon={ClipboardList} />
        <StatTile label="Students" value={stats?.students ?? 0} icon={UsersRound} />
        <StatTile label="Open maintenance" value={stats?.openMaintenanceRequests ?? 0} icon={Wrench} />
        <StatTile label="SLA breached" value={slaBreachedRequests.length} icon={AlertTriangle} />
        <StatTile label="Available rooms" value={`${stats?.availableRooms ?? 0}/${stats?.totalRooms ?? 0}`} icon={Building2} />
        <StatTile label="Open incidents" value={incidents.items.filter((item) => item.status !== 'CLOSED' && item.status !== 'RESOLVED').length} icon={ShieldCheck} />
        <StatTile label="Storage active" value={storageRequests.items.filter((item) => !['ITEMS_RELEASED', 'CANCELLED', 'REJECTED'].includes(item.status)).length} icon={Archive} />
        <StatTile label="Inspections" value={inspections.total} icon={ClipboardList} />
      </div>

      <div className="mt-6 grid gap-6">
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Application Review</h2>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {applications.items.length ? (
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-slate-500">
                  <tr><th className="py-3">Reference</th><th>Student</th><th>Residence</th><th>Documents</th><th>Status</th><th>Update</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {applications.items.map((application) => (
                    <tr key={application.id}>
                      <td className="py-3 font-semibold">{application.referenceCode}</td>
                      <td>{application.applicantFirstName} {application.applicantLastName}<br /><span className="text-xs text-slate-500">{application.user?.email}</span></td>
                      <td>{application.residence?.name}<br /><span className="text-xs text-slate-500">{application.room?.name ?? 'No room assigned'}</span></td>
                      <td className={application.documentsComplete ? 'text-emerald-700' : 'text-amber-700'}>
                        {application.documentsComplete ? 'Complete' : `${application.missingDocumentTypes?.length ?? 0} missing`}
                      </td>
                      <td><StatusBadge status={application.status} /></td>
                      <td>
                        <form onSubmit={(event) => updateApplication(event, application)} className="grid gap-2">
                          <div className="flex gap-2">
                            <select name="status" defaultValue={application.status} className="focus-ring h-9 rounded-lg border border-line px-2">
                              {applicationStatuses.map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
                            </select>
                            <select name="roomId" defaultValue={application.room?.id ?? ''} className="focus-ring h-9 rounded-lg border border-line px-2">
                              <option value="">Room</option>
                              {rooms
                                .filter((room) => room.residenceId === application.residence.id && (room.status === 'AVAILABLE' || room.id === application.room?.id))
                                .map((room) => <option key={room.id} value={room.id}>{room.name} - {formatEnum(room.status)}</option>)}
                            </select>
                          </div>
                          <textarea name="note" rows={2} placeholder="Student-facing note" className="focus-ring rounded-lg border border-line px-2 py-1.5" />
                          <button className="focus-ring inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-line px-3 font-semibold hover:bg-slate-50">
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="No applications" body="Submitted applications will appear here." />}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Maintenance Workflow</h2>
            <div className="mt-4 grid gap-3">
              {maintenance.items.map((request) => (
                <form key={request.id} onSubmit={(event) => updateMaintenance(event, request.id)} className="grid gap-3 rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{request.title}</p>
                      <p className="text-slate-500">{request.referenceCode} - {formatEnum(request.priority)} priority</p>
                    </div>
                    <span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(request.status)}</span>
                  </div>
                  <p className="text-slate-600">{request.description}</p>
                  <MaintenanceSlaPanel request={request} />
                  <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
                    <select
                      name="status"
                      defaultValue={maintenanceStatuses.includes(request.status) ? request.status : 'ACKNOWLEDGED'}
                      className="focus-ring h-9 rounded-lg border border-line px-2"
                    >
                      {maintenanceStatuses.map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
                    </select>
                    <input name="resolutionNote" placeholder="Resolution note" defaultValue={request.resolutionNote ?? ''} className="focus-ring h-9 rounded-lg border border-line px-2" />
                    <button className="focus-ring h-9 rounded-lg border border-line px-3 font-semibold hover:bg-slate-50">Save</button>
                  </div>
                </form>
              ))}
              {!maintenance.items.length && <EmptyState title="No maintenance" body="Maintenance requests will appear here." />}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Security Incidents</h2>
            <div className="mt-4 grid gap-3">
              {incidents.items.map((incident) => (
                <form key={incident.id} onSubmit={(event) => updateIncident(event, incident.id)} className="grid gap-3 rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{incident.title}</p>
                      <p className="text-slate-500">{incident.referenceCode} - {incident.category}</p>
                    </div>
                    <span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(incident.severity)}</span>
                  </div>
                  <p className="text-slate-600">{incident.description}</p>
                  <div className="grid gap-2 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
                    <select name="status" defaultValue={incident.status} className="focus-ring h-9 rounded-lg border border-line px-2">
                      {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
                    </select>
                    <input name="resolutionNote" placeholder="Resolution note" defaultValue={incident.resolutionNote ?? ''} className="focus-ring h-9 rounded-lg border border-line px-2" />
                    <button className="focus-ring h-9 rounded-lg border border-line px-3 font-semibold hover:bg-slate-50">Save</button>
                  </div>
                </form>
              ))}
              {!incidents.items.length && <EmptyState title="No incidents" body="Security incident reports will appear here." />}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
            <form onSubmit={sendCommunication} className="grid gap-4">
              <div>
                <h2 className="font-semibold text-ink">Maintenance Communication</h2>
                <p className="mt-1 text-sm text-slate-500">Send notices to active residents with valid email addresses.</p>
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
                  {stats?.residences.map((residence) => <option key={residence.id} value={residence.id}>{residence.name}</option>)}
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
                {!communications.items.length && <EmptyState title="No communications" body="Maintenance communication history will appear here." />}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-ink">Storage Reporting</h2>
              <p className="mt-1 text-sm text-slate-500">Recent student storage submissions, status and supporting files.</p>
            </div>
            <button
              type="button"
              onClick={() => downloadStorageExport().catch((error) => toast.error(error.message))}
              className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {storageRequests.items.length ? (
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-slate-500">
                  <tr><th className="py-3">Reference</th><th>Student</th><th>Accommodation</th><th>Storage details</th><th>Status</th><th>Files</th><th>Submitted</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {storageRequests.items.map((request) => (
                    <tr key={request.id}>
                      <td className="py-3 font-semibold">{request.referenceCode}</td>
                      <td>{request.studentFullName ?? `${request.user?.firstName ?? ''} ${request.user?.lastName ?? ''}`.trim()}<br /><span className="text-xs text-slate-500">{request.studentNumber ?? request.application?.studentNumber ?? request.user?.studentProfile?.studentNumber ?? ''}</span></td>
                      <td>{request.residence?.name ?? 'Not linked'}<br /><span className="text-xs text-slate-500">{request.room?.name ?? 'No room'}</span></td>
                      <td>
                        <div className="grid gap-1 text-xs text-slate-600">
                          <span>{request.storageSite ? formatEnum(request.storageSite) : 'Site not captured'}</span>
                          <span>{request.numberOfItemsStored ?? 'No'} items</span>
                          <span>Room {request.studentRoomNumber ?? request.room?.roomNumber ?? request.room?.name ?? 'not captured'}</span>
                        </div>
                      </td>
                      <td><span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(request.status)}</span></td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {request.files.map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              title={file.originalName}
                              onClick={() => downloadStorageFile(file.id, file.originalName).catch((error) => toast.error(error.message))}
                              className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {file.fileType === 'FORM' ? 'Form' : 'Photo'}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>{formatDateTime(request.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="No storage requests" body="Student storage submissions will appear here." />}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-ink">Finance Reporting</h2>
              <p className="mt-1 text-sm text-slate-500">Approved, accepted and actively room-assigned residents.</p>
            </div>
            <button
              type="button"
              onClick={() => downloadFinanceExport().catch((error) => toast.error(error.message))}
              className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {financeReport.items.length ? (
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-slate-500">
                  <tr><th className="py-3">Student</th><th>Funding</th><th>Accommodation</th><th>Contact</th><th>Accepted</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {financeReport.items.map((row) => (
                    <tr key={row.applicationId}>
                      <td className="py-3 font-semibold">{row.fullName}<br /><span className="text-xs text-slate-500">{row.studentNumber}</span></td>
                      <td>{row.fundingType || 'Not captured'}<br /><span className="text-xs text-slate-500">{row.bursaryName}</span></td>
                      <td>{row.accommodation}<br /><span className="text-xs text-slate-500">{row.roomNumber}</span></td>
                      <td>{row.studentContactNumber || row.email}</td>
                      <td>{formatDateTime(row.acceptanceDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="No finance records" body="Active resident finance records will appear here." />}
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-ink">Inspection Reporting</h2>
              <p className="mt-1 text-sm text-slate-500">Room inspections, follow-ups, maintenance flags, and completion status.</p>
            </div>
            <button
              type="button"
              onClick={() => downloadInspectionExport().catch((error) => toast.error(error.message))}
              className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {inspections.items.length ? (
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-slate-500">
                  <tr><th className="py-3">Reference</th><th>Student</th><th>Room</th><th>Key</th><th>Dates</th><th>Status</th><th>Follow-up</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {inspections.items.map((inspection) => (
                    <tr key={inspection.id}>
                      <td className="py-3 font-semibold">{inspection.referenceCode}</td>
                      <td>{inspection.studentFullName || inspection.occupantNames || 'No student captured'}<br /><span className="text-xs text-slate-500">{inspection.studentNumber ?? ''}</span></td>
                      <td>{inspection.residence.name}<br /><span className="text-xs text-slate-500">{inspection.room.name}</span></td>
                      <td>{inspection.keyNumberIssued || 'Not captured'}</td>
                      <td>
                        In: {formatDateTime(inspection.checkInDate) || formatDateTime(inspection.inspectionDate)}
                        <br />
                        <span className="text-xs text-slate-500">Out: {formatDateTime(inspection.checkOutDate) || 'Not captured'}</span>
                      </td>
                      <td><span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(inspection.status)}</span></td>
                      <td>{inspection.followUpRequired ? inspection.followUpActions || 'Required' : 'No follow-up'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <EmptyState title="No inspections" body="Room inspections will appear here after they are captured." />}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Residence Occupancy</h2>
            <div className="mt-4 grid gap-3">
              {stats?.residences.map((residence) => (
                <div key={residence.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <p className="font-semibold text-ink">{residence.name}</p>
                    <p>{residence.availableRooms}/{residence.totalRooms} available</p>
                  </div>
                  <p className="mt-1 text-slate-500">{residence.address}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Recent Visitors</h2>
            <div className="mt-4 grid gap-3">
              {visitors.items.map((visitor) => (
                <div key={visitor.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-3">
                    <p className="font-semibold text-ink">{visitor.visitorName}</p>
                    <span className={visitor.checkedOutAt ? 'text-slate-500' : 'text-emerald-700'}>{visitor.checkedOutAt ? 'Checked out' : 'On site'}</span>
                  </div>
                  <p className="mt-1 text-slate-500">{visitor.residentName || 'Resident not captured'} - {formatDateTime(visitor.checkedInAt)}</p>
                </div>
              ))}
              {!visitors.items.length && <EmptyState title="No visitor logs" body="Visitor check-ins will appear here." />}
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Student Records</h2>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-slate-500">
                <tr><th className="py-3">Name</th><th>Email</th><th>Status</th><th>Student number</th><th>Profile photo</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.items.map((student) => (
                  <tr key={student.id}>
                    <td className="py-3 font-semibold">{student.firstName} {student.lastName}</td>
                    <td>{student.email}</td>
                    <td>{student.status}</td>
                    <td>{student.studentProfile?.studentNumber ?? ''}</td>
                    <td>{student.studentProfile?.hasProfileImage ? 'Uploaded' : 'Missing'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
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

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '';
}
