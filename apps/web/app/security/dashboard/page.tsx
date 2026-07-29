'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Building2, Check, Clock3, DoorOpen, RefreshCw, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { AppShell, EmptyState, StatTile } from '@/components/AppShell';
import { useToast } from '@/components/ToastProvider';
import { api, compactForm, getSession } from '@/lib/api';
import { dashboardPathForRoles } from '@/lib/role-routing';
import type { IncidentReport, Paginated, Residence, ResidenceRoom, VisitorPreRegistration, VisitorLog } from '@/lib/types';

type StudentLookup = {
  userId: string;
  studentName: string;
  studentNumber: string;
  hasProfileImage: boolean;
  residence: Pick<Residence, 'id' | 'name' | 'address'>;
  room?: Pick<ResidenceRoom, 'id' | 'name' | 'roomNumber'> | null;
  residencyStatus: string;
  preRegistrations: Array<Pick<
    VisitorPreRegistration,
    | 'id'
    | 'visitorName'
    | 'visitorPhone'
    | 'visitorIdNumber'
    | 'relationship'
    | 'expectedVisitDate'
    | 'expectedArrivalTime'
    | 'vehicleRegistration'
    | 'notes'
    | 'status'
  >>;
};

const securityDashboardRoles = ['SECURITY', 'MANAGER', 'ADMINISTRATOR'];

export default function SecurityDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [rooms, setRooms] = useState<ResidenceRoom[]>([]);
  const [visitors, setVisitors] = useState<Paginated<VisitorLog>>({ items: [], total: 0, page: 1, limit: 20 });
  const [preRegistrations, setPreRegistrations] = useState<Paginated<VisitorPreRegistration>>({ items: [], total: 0, page: 1, limit: 20 });
  const [incidents, setIncidents] = useState<Paginated<IncidentReport>>({ items: [], total: 0, page: 1, limit: 20 });
  const [studentNumber, setStudentNumber] = useState('');
  const [studentLookup, setStudentLookup] = useState<StudentLookup | null>(null);
  const [selectedPreRegistration, setSelectedPreRegistration] = useState('');
  const [now, setNow] = useState(() => Date.now());

  async function load() {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!securityDashboardRoles.some((role) => session.user.roles.includes(role))) {
      router.replace(dashboardPathForRoles(session.user.roles));
      return;
    }

    const [nextResidences, nextRooms, nextVisitors, nextPreRegistrations, nextIncidents] = await Promise.all([
      api<Residence[]>('/residences'),
      api<ResidenceRoom[]>('/residence-rooms'),
      api<Paginated<VisitorLog>>('/security/visitors?page=1&limit=20'),
      api<Paginated<VisitorPreRegistration>>('/security/visitor-pre-registrations?page=1&limit=20&status=PENDING'),
      api<Paginated<IncidentReport>>('/security/incidents?page=1&limit=20'),
    ]);
    setResidences(nextResidences);
    setRooms(nextRooms);
    setVisitors(nextVisitors);
    setPreRegistrations(nextPreRegistrations);
    setIncidents(nextIncidents);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((error) => {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : 'Could not load security dashboard');
    });
    const countdownTimer = window.setInterval(() => setNow(Date.now()), 1000);
    const refreshTimer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 60000);
    return () => {
      window.clearInterval(countdownTimer);
      window.clearInterval(refreshTimer);
    };
  }, []);

  async function createVisitor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/security/visitors', { method: 'POST', body: JSON.stringify(compactForm(form)) });
      toast.success('Visitor checked in');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not check in visitor');
    }
  }

  async function lookupStudentNumber() {
    const cleanStudentNumber = studentNumber.trim();
    if (!cleanStudentNumber) {
      toast.error('Enter a student number first');
      return;
    }
    try {
      const result = await api<StudentLookup>(`/security/students/lookup?studentNumber=${encodeURIComponent(cleanStudentNumber)}`);
      setStudentLookup(result);
      setSelectedPreRegistration('');
      toast.success('Student found');
    } catch (error) {
      setStudentLookup(null);
      toast.error(error instanceof Error ? error.message : 'Could not find student');
    }
  }

  async function checkoutVisitor(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/security/visitors/${id}/checkout`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Visitor checked out');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not check out visitor');
    }
  }

  async function updatePreRegistrationStatus(id: string, status: 'APPROVED' | 'REJECTED') {
    try {
      await api(`/security/visitor-pre-registrations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success(status === 'APPROVED' ? 'Visitor pre-registration approved' : 'Visitor pre-registration rejected');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update visitor pre-registration');
    }
  }

  async function createIncident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/security/incidents', { method: 'POST', body: JSON.stringify(compactForm(form)) });
      toast.success('Incident reported');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not report incident');
    }
  }

  if (loading) {
    return (
      <AppShell mode="security">
        <div className="grid min-h-80 place-items-center text-sm text-slate-500">
          <RefreshCw className="mb-3 h-5 w-5 animate-spin text-brand" />
          Loading
        </div>
      </AppShell>
    );
  }

  const activeVisitors = visitors.items.filter((visitor) => !visitor.checkedOutAt);
  const overdueVisitors = activeVisitors.filter((visitor) => visitorCheckoutState(visitor.checkedInAt, now).overdue);
  const pendingPreRegistrations = preRegistrations.items.filter((registration) => registration.status === 'PENDING');
  const openIncidents = incidents.items.filter((incident) => incident.status !== 'RESOLVED' && incident.status !== 'CLOSED');
  const availableRooms = rooms.filter((room) => room.status === 'AVAILABLE').length;
  const maintenanceRooms = rooms.filter((room) => room.status === 'MAINTENANCE').length;

  return (
    <AppShell mode="security">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Security Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Visitor control, incident reporting, and room visibility.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Visitors on site" value={activeVisitors.length} icon={UserPlus} />
        <StatTile label="Pending approvals" value={pendingPreRegistrations.length} icon={ShieldCheck} />
        <StatTile label="Checkout overdue" value={overdueVisitors.length} icon={Clock3} />
        <StatTile label="Open incidents" value={openIncidents.length} icon={AlertTriangle} />
        <StatTile label="Available rooms" value={availableRooms} icon={DoorOpen} />
        <StatTile label="Rooms in maintenance" value={maintenanceRooms} icon={Building2} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <form onSubmit={createVisitor} className="grid gap-4 rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Visitor Check-In</h2>
          <div className="rounded-lg border border-line bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
                placeholder="Student number"
                className="focus-ring h-10 rounded-lg border border-line bg-white px-3 text-sm"
              />
              <button
                type="button"
                onClick={() => lookupStudentNumber().catch((error) => toast.error(error.message))}
                className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-semibold hover:bg-slate-50"
              >
                <Search className="h-4 w-4" />
                Lookup
              </button>
            </div>
            {studentLookup && (
              <div className="mt-3 rounded-lg border border-line bg-white p-3 text-sm">
                <p className="font-semibold text-ink">{studentLookup.studentName}</p>
                <p className="mt-1 text-slate-500">
                  {studentLookup.studentNumber} - {studentLookup.residence.name} - {studentLookup.room?.name ?? 'No room'}
                </p>
                <p className="mt-1 text-xs font-semibold uppercase text-emerald-700">{studentLookup.residencyStatus}</p>
              </div>
            )}
          </div>
          <input type="hidden" name="studentNumber" value={studentLookup?.studentNumber ?? studentNumber} readOnly />
          <label className="grid gap-1 text-sm font-medium text-ink">
            Approved pre-registered visitor
            <select
              name="preRegistrationId"
              value={selectedPreRegistration}
              onChange={(event) => {
                const id = event.target.value;
                setSelectedPreRegistration(id);
                const selected = studentLookup?.preRegistrations.find((visitor) => visitor.id === id);
                if (selected) {
                  const form = event.currentTarget.form;
                  const visitorName = form?.querySelector<HTMLInputElement>('[name="visitorName"]');
                  const visitorPhone = form?.querySelector<HTMLInputElement>('[name="visitorPhone"]');
                  const visitorIdNumber = form?.querySelector<HTMLInputElement>('[name="visitorIdNumber"]');
                  const relationship = form?.querySelector<HTMLInputElement>('[name="relationship"]');
                  const vehicleRegistration = form?.querySelector<HTMLInputElement>('[name="vehicleRegistration"]');
                  if (visitorName) visitorName.value = selected.visitorName;
                  if (visitorPhone) visitorPhone.value = selected.visitorPhone ?? '';
                  if (visitorIdNumber) visitorIdNumber.value = selected.visitorIdNumber ?? '';
                  if (relationship) relationship.value = selected.relationship;
                  if (vehicleRegistration) vehicleRegistration.value = selected.vehicleRegistration ?? '';
                }
              }}
              className="focus-ring h-11 rounded-lg border border-line bg-white px-3"
            >
              <option value="">Walk-in or select approved visitor</option>
              {studentLookup?.preRegistrations.map((visitor) => (
                <option key={visitor.id} value={visitor.id}>
                  {visitor.visitorName} - {new Date(visitor.expectedVisitDate).toLocaleDateString()} {visitor.expectedArrivalTime}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Visitor name
            <input name="visitorName" required maxLength={120} className="focus-ring h-11 rounded-lg border border-line px-3" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-ink">
              Phone
              <input name="visitorPhone" className="focus-ring h-11 rounded-lg border border-line px-3" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              ID / Passport
              <input name="visitorIdNumber" maxLength={80} className="focus-ring h-11 rounded-lg border border-line px-3" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-ink">
              Relationship
              <input name="relationship" maxLength={80} className="focus-ring h-11 rounded-lg border border-line px-3" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              Purpose
              <input name="purpose" maxLength={240} className="focus-ring h-11 rounded-lg border border-line px-3" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              Vehicle registration
              <input name="vehicleRegistration" maxLength={40} className="focus-ring h-11 rounded-lg border border-line px-3" />
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Override reason
            <input name="overrideReason" maxLength={500} placeholder="Required only for authorised manager/admin after hours" className="focus-ring h-11 rounded-lg border border-line px-3" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Notes
            <textarea name="notes" rows={3} maxLength={1000} className="focus-ring rounded-lg border border-line px-3 py-2" />
          </label>
          <label className="flex items-start gap-2 text-sm font-medium text-ink">
            <input name="termsAccepted" required type="checkbox" className="mt-1 h-4 w-4 rounded border-line text-brand" />
            Visitor terms and conditions accepted
          </label>
          <button className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white">
            <UserPlus className="h-4 w-4" />
            Check in visitor
          </button>
        </form>

        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Active Visitors</h2>
          <div className="mt-4 grid gap-3">
            {activeVisitors.map((visitor) => (
              <div key={visitor.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{visitor.visitorName}</p>
                    <p className="mt-1 text-slate-500">
                      {visitor.residentName || `${visitor.user?.firstName ?? ''} ${visitor.user?.lastName ?? ''}`.trim() || 'Resident not captured'} - {formatDateTime(visitor.checkedInAt)}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {visitor.user?.studentProfile?.studentNumber ?? 'No student number'} - {visitor.residence?.name ?? 'No residence'} - {visitor.room?.name ?? 'No room'}
                    </p>
                    {visitor.relationship && <p className="mt-1 text-slate-500">Relationship: {visitor.relationship}</p>}
                    {visitor.vehicleRegistration && <p className="mt-1 text-slate-500">Vehicle: {visitor.vehicleRegistration}</p>}
                    {visitor.overrideReason && <p className="mt-1 text-amber-700">After-hours override: {visitor.overrideReason}</p>}
                    <VisitorCheckoutCountdown
                      checkedInAt={visitor.checkedInAt}
                      now={now}
                      reminderSentAt={visitor.checkoutReminderSentAt}
                    />
                  </div>
                  <form onSubmit={(event) => checkoutVisitor(event, visitor.id)} className="grid gap-2 sm:w-56">
                    <input name="checkoutNotes" placeholder="Checkout notes" maxLength={500} className="focus-ring h-9 rounded-lg border border-line px-2 text-sm" />
                    <button className="focus-ring h-9 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-slate-50">
                      Check out
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {!activeVisitors.length && <EmptyState title="No active visitors" body="Visitors currently on site will appear here." />}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">Visitor Pre-Registration Approvals</h2>
            <p className="text-sm text-slate-500">Student visitor requests waiting for security approval.</p>
          </div>
          <span className="w-fit rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-slate-600">
            {pendingPreRegistrations.length} pending
          </span>
        </div>
        <div className="mt-4 grid gap-3">
          {pendingPreRegistrations.map((registration) => (
            <div key={registration.id} className="rounded-lg border border-line p-3 text-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{registration.visitorName}</p>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      {formatEnum(registration.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    {new Date(registration.expectedVisitDate).toLocaleDateString()} at {registration.expectedArrivalTime}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Student: {registration.user ? `${registration.user.firstName ?? ''} ${registration.user.lastName ?? ''}`.trim() || registration.user.email : 'Not captured'}
                    {' '} - {registration.user?.studentProfile?.studentNumber ?? 'No student number'}
                  </p>
                  <p className="mt-1 text-slate-500">
                    {registration.residence?.name ?? 'No residence'} - {registration.room?.name ?? 'No room'}
                  </p>
                  <div className="mt-3 grid gap-1 rounded-lg border border-line bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                    <span>Relationship: {registration.relationship}</span>
                    <span>Phone: {registration.visitorPhone ?? 'Not captured'}</span>
                    <span>ID / Passport: {registration.visitorIdNumber ?? 'Not captured'}</span>
                    <span>Vehicle: {registration.vehicleRegistration ?? 'None'}</span>
                  </div>
                  {registration.notes && <p className="mt-3 whitespace-pre-line text-slate-600">{registration.notes}</p>}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-60 lg:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => updatePreRegistrationStatus(registration.id, 'APPROVED')}
                    className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePreRegistrationStatus(registration.id, 'REJECTED')}
                    className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!pendingPreRegistrations.length && (
            <EmptyState title="No pending visitor approvals" body="Student pre-registrations will appear here for security approval." />
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <form onSubmit={createIncident} className="grid gap-4 rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Report Incident</h2>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Title
            <input name="title" required maxLength={160} className="focus-ring h-11 rounded-lg border border-line px-3" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-ink">
              Category
              <input name="category" required maxLength={80} placeholder="Access, safety, noise..." className="focus-ring h-11 rounded-lg border border-line px-3" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-ink">
              Severity
              <select name="severity" required defaultValue="LOW" className="focus-ring h-11 rounded-lg border border-line bg-white px-3">
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((severity) => <option key={severity} value={severity}>{formatEnum(severity)}</option>)}
              </select>
            </label>
          </div>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Residence
            <select name="residenceId" className="focus-ring h-11 rounded-lg border border-line bg-white px-3">
              <option value="">Not specified</option>
              {residences.map((residence) => <option key={residence.id} value={residence.id}>{residence.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Location
            <input name="location" maxLength={200} className="focus-ring h-11 rounded-lg border border-line px-3" />
          </label>
          <label className="grid gap-1 text-sm font-medium text-ink">
            Description
            <textarea name="description" required rows={5} maxLength={3000} className="focus-ring rounded-lg border border-line px-3 py-2" />
          </label>
          <button className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4" />
            Submit incident
          </button>
        </form>

        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Recent Incidents</h2>
          <div className="mt-4 grid gap-3">
            {incidents.items.map((incident) => (
              <div key={incident.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{incident.title}</p>
                    <p className="mt-1 text-slate-500">{incident.referenceCode} - {incident.category}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(incident.severity)}</span>
                    <span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(incident.status)}</span>
                  </div>
                </div>
                <p className="mt-3 text-slate-600">{incident.description}</p>
              </div>
            ))}
            {!incidents.items.length && <EmptyState title="No incidents" body="Submitted security incidents will appear here." />}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
        <h2 className="font-semibold text-ink">Room Visibility</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rooms.map((room) => (
            <div key={room.id} className="rounded-lg border border-line p-3 text-sm">
              <p className="font-semibold text-ink">{room.name}</p>
              <p className="mt-1 text-slate-500">{room.genderAllocation} - {room.roomTypeName}</p>
              <span className="mt-3 inline-flex rounded-full border border-line px-2 py-1 text-xs">{formatEnum(room.status)}</span>
            </div>
          ))}
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

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '';
}

function VisitorCheckoutCountdown({
  checkedInAt,
  now,
  reminderSentAt,
}: {
  checkedInAt: string;
  now: number;
  reminderSentAt?: string | null;
}) {
  const state = visitorCheckoutState(checkedInAt, now);
  return (
    <div className={`mt-3 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
      state.overdue
        ? 'border-red-200 bg-red-50 text-red-700'
        : state.totalMs <= 60 * 60 * 1000
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
    }`}>
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{state.overdue ? `Checkout overdue by ${formatCountdownDuration(Math.abs(state.totalMs))}` : `Checkout due in ${formatCountdownDuration(state.totalMs)}`}</span>
      <span className="font-medium opacity-80">Deadline 10:00 PM</span>
      {reminderSentAt && <span className="font-medium opacity-80">Email sent {formatDateTime(reminderSentAt)}</span>}
    </div>
  );
}

function visitorCheckoutState(checkedInAt: string, now: number) {
  const dueAt = visitorCheckoutDueAt(checkedInAt);
  const totalMs = dueAt.getTime() - now;
  return { dueAt, totalMs, overdue: totalMs <= 0 };
}

function visitorCheckoutDueAt(checkedInAt: string) {
  const checkedIn = new Date(checkedInAt);
  const parts = new Intl.DateTimeFormat('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(checkedIn);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);
  const day = Number(parts.find((part) => part.type === 'day')?.value);
  return new Date(Date.UTC(year, month - 1, day, 20, 0, 0, 0));
}

function formatCountdownDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const time = [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  return days ? `${days}d ${time}` : time;
}
