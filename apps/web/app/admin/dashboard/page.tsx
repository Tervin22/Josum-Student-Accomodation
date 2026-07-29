'use client';

import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  ClipboardList,
  Download,
  History,
  LayoutDashboard,
  Mail,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  UsersRound,
  UserX,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AppShell, EmptyState, StatTile } from '@/components/AppShell';
import { MaintenanceSlaPanel } from '@/components/MaintenanceSlaPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/ToastProvider';
import { api, clearSession, compactForm, downloadDocument, downloadFinanceExport, downloadInspectionAttachment, downloadInspectionExport, downloadStorageExport, downloadStorageFile, getSession, upload } from '@/lib/api';
import { isMaintenanceSlaBreached } from '@/lib/maintenance-sla';
import { dashboardPathForRoles } from '@/lib/role-routing';
import type { Application, ApplicationStatus, CommunicationRecord, FinanceReportRow, Inspection, InspectionPeriod, InspectionStatus, MaintenanceRequest, MaintenanceStatus, Paginated, Residence, ResidenceRoom, StorageRequest, StorageRequestStatus, User } from '@/lib/types';

type Tab = 'overview' | 'applications' | 'maintenance' | 'storage' | 'finance' | 'inspections' | 'rooms' | 'students' | 'communications' | 'settings' | 'templates' | 'audit';
type Stats = {
  students: number;
  applications: number;
  pendingApplications: number;
  maintenanceRequests: number;
  openMaintenanceRequests: number;
  roomTypes: number;
  documents: number;
  totalRooms: number;
  availableRooms: number;
  residences: Array<Residence & { occupiedRooms: number }>;
  statuses: Record<string, number>;
};
type Setting = { id: string; key: string; value: unknown; description?: string };
type Template = { id: string; key: string; subject: string; body: string; enabled: boolean };
type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  createdAt: string;
  actor?: Pick<User, 'email' | 'firstName' | 'lastName'>;
};

type DashboardLoadResult =
  | { label: string; status: 'fulfilled'; value: unknown }
  | { label: string; status: 'rejected'; reason: unknown };

const tabs: Array<{ id: Tab; icon: LucideIcon; title: string }> = [
  { id: 'overview', icon: LayoutDashboard, title: 'Overview' },
  { id: 'applications', icon: ClipboardList, title: 'Applications' },
  { id: 'maintenance', icon: Wrench, title: 'Maintenance' },
  { id: 'storage', icon: Archive, title: 'Storage' },
  { id: 'finance', icon: ClipboardList, title: 'Finance' },
  { id: 'inspections', icon: ClipboardList, title: 'Inspections' },
  { id: 'rooms', icon: Building2, title: 'Rooms' },
  { id: 'students', icon: UsersRound, title: 'Students' },
  { id: 'communications', icon: Mail, title: 'Communications' },
  { id: 'settings', icon: Settings, title: 'Settings' },
  { id: 'templates', icon: Mail, title: 'Email templates' },
  { id: 'audit', icon: History, title: 'Audit logs' },
];

const statuses: ApplicationStatus[] = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'WAITLISTED',
  'CANCELLED',
  'MOVED_OUT',
];

const maintenanceWorkflowStatuses: MaintenanceStatus[] = ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const storageStatuses: StorageRequestStatus[] = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ITEMS_RECEIVED', 'RELEASE_REQUESTED', 'ITEMS_RELEASED', 'CANCELLED'];
const inspectionStatuses: InspectionStatus[] = ['DRAFT', 'COMPLETED', 'FOLLOW_UP_REQUIRED', 'CLOSED'];
const handoverConditionFields = [
  { key: 'bedroom', label: 'Bedroom' },
  { key: 'walls', label: 'Walls' },
  { key: 'ceiling', label: 'Ceiling' },
  { key: 'lights', label: 'Lights' },
  { key: 'plugs', label: 'Plugs' },
  { key: 'cupboards', label: 'Cupboards' },
  { key: 'doorLockKey', label: 'Door/lock/key' },
  { key: 'tiling', label: 'Tiling' },
  { key: 'fridge', label: 'Fridge' },
  { key: 'bed', label: 'Bed' },
  { key: 'windowBlind', label: 'Window and blind' },
  { key: 'windowFrame', label: 'Window frame' },
  { key: 'other', label: 'Other' },
] as const;
const handoverDocumentChecklist = [
  ['certifiedIdCopy', 'Certified ID copy'],
  ['proofOfRegistration', 'Proof of registration'],
  ['academicRecord', 'Academic record'],
  ['proofOfFunding', 'Proof of funding / bursary / NSFAS'],
  ['signedLeaseAgreement', 'Signed lease agreement'],
] as const;
const communicationTypes = ['POWER_OUTAGE', 'WATER_OUTAGE', 'PLANNED_MAINTENANCE', 'EMERGENCY_MAINTENANCE', 'GENERAL_COMMUNICATION', 'CUSTOM_COMMUNICATION'];
type DashboardTabEventDetail = { mode?: 'student' | 'admin'; tab?: string };

const staffPortalRoles = ['ADMINISTRATOR', 'MANAGER', 'SECURITY', 'TECHNICIAN'];
const applicationReviewRoles = ['ADMINISTRATOR', 'MANAGER'];
const maintenanceWorkflowRoles = ['ADMINISTRATOR', 'MANAGER', 'TECHNICIAN'];
const storageManagementRoles = ['ADMINISTRATOR', 'MANAGER'];
const communicationManagementRoles = ['ADMINISTRATOR', 'MANAGER', 'TECHNICIAN'];
const inspectionManagementRoles = ['ADMINISTRATOR', 'MANAGER'];
const roomViewRoles = ['ADMINISTRATOR', 'MANAGER', 'SECURITY', 'TECHNICIAN'];
const roomManagementRoles = ['ADMINISTRATOR', 'MANAGER'];
const studentRecordRoles = ['ADMINISTRATOR', 'MANAGER'];

const emptyStats: Stats = {
  students: 0,
  applications: 0,
  pendingApplications: 0,
  maintenanceRequests: 0,
  openMaintenanceRequests: 0,
  roomTypes: 0,
  documents: 0,
  totalRooms: 0,
  availableRooms: 0,
  residences: [],
  statuses: {},
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [factoryResetOpen, setFactoryResetOpen] = useState(false);
  const [factoryResetLoading, setFactoryResetLoading] = useState(false);
  const [terminatingStudent, setTerminatingStudent] = useState<User | null>(null);
  const [studentActionLoading, setStudentActionLoading] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [applications, setApplications] = useState<Paginated<Application>>({ items: [], total: 0, page: 1, limit: 20 });
  const [maintenanceRequests, setMaintenanceRequests] = useState<Paginated<MaintenanceRequest>>({ items: [], total: 0, page: 1, limit: 50 });
  const [storageRequests, setStorageRequests] = useState<Paginated<StorageRequest>>({ items: [], total: 0, page: 1, limit: 50 });
  const [financeReport, setFinanceReport] = useState<Paginated<FinanceReportRow>>({ items: [], total: 0, page: 1, limit: 50 });
  const [inspections, setInspections] = useState<Paginated<Inspection>>({ items: [], total: 0, page: 1, limit: 50 });
  const [inspectionPeriods, setInspectionPeriods] = useState<InspectionPeriod[]>([]);
  const [students, setStudents] = useState<Paginated<User>>({ items: [], total: 0, page: 1, limit: 20 });
  const [communications, setCommunications] = useState<Paginated<CommunicationRecord>>({ items: [], total: 0, page: 1, limit: 20 });
  const [residenceRooms, setResidenceRooms] = useState<ResidenceRoom[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [audit, setAudit] = useState<Paginated<AuditLog>>({ items: [], total: 0, page: 1, limit: 50 });
  const [applicationSearch, setApplicationSearch] = useState('');
  const [applicationStatus, setApplicationStatus] = useState('');
  const [applicationResidence, setApplicationResidence] = useState('');
  const [storageSearch, setStorageSearch] = useState('');
  const [storageStatus, setStorageStatus] = useState('');
  const [storageResidence, setStorageResidence] = useState('');
  const [financeSearch, setFinanceSearch] = useState('');
  const [financeResidence, setFinanceResidence] = useState('');
  const [financeFundingType, setFinanceFundingType] = useState('');
  const [inspectionSearch, setInspectionSearch] = useState('');
  const [inspectionStatus, setInspectionStatus] = useState('');
  const [inspectionResidence, setInspectionResidence] = useState('');
  const [inspectionPeriod, setInspectionPeriod] = useState('');
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sessionRoles, setSessionRoles] = useState<string[]>([]);

  async function load() {
    setLoading(true);
    setLoadError('');
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    const currentRoles = session.user.roles;
    setSessionRoles(currentRoles);
    if (!currentRoles.includes('ADMINISTRATOR')) {
      router.replace(dashboardPathForRoles(currentRoles));
      return;
    }
    const allowedTabs = tabs.filter(({ id }) => canAccessTab(id, currentRoles));
    if (!allowedTabs.some((item) => item.id === tab)) {
      setTab(allowedTabs[0]?.id ?? 'overview');
    }
    setStats(emptyStats);

    const appQuery = new URLSearchParams({ page: '1', limit: '20' });
    if (applicationSearch) appQuery.set('search', applicationSearch);
    if (applicationStatus) appQuery.set('status', applicationStatus);
    if (applicationResidence) appQuery.set('residenceId', applicationResidence);
    const storageQuery = new URLSearchParams({ page: '1', limit: '50' });
    if (storageSearch) storageQuery.set('search', storageSearch);
    if (storageStatus) storageQuery.set('status', storageStatus);
    if (storageResidence) storageQuery.set('residenceId', storageResidence);
    const financeQuery = new URLSearchParams({ page: '1', limit: '50' });
    if (financeSearch) financeQuery.set('search', financeSearch);
    if (financeResidence) financeQuery.set('residenceId', financeResidence);
    if (financeFundingType) financeQuery.set('fundingType', financeFundingType);
    const inspectionQuery = new URLSearchParams({ page: '1', limit: '50' });
    if (inspectionSearch) inspectionQuery.set('search', inspectionSearch);
    if (inspectionStatus) inspectionQuery.set('status', inspectionStatus);
    if (inspectionResidence) inspectionQuery.set('residenceId', inspectionResidence);
    if (inspectionPeriod) inspectionQuery.set('periodId', inspectionPeriod);

    const requests: Array<Promise<DashboardLoadResult>> = [];
    if (hasAnyRole(currentRoles, applicationReviewRoles)) {
      requests.push(settle('overview statistics', api<Stats>('/applications/admin/stats')));
      requests.push(settle('applications', api<Paginated<Application>>(`/applications/admin?${appQuery}`)));
    }
    if (hasAnyRole(currentRoles, maintenanceWorkflowRoles)) {
      requests.push(settle('maintenance', api<Paginated<MaintenanceRequest>>('/maintenance/admin?page=1&limit=50')));
    }
    if (hasAnyRole(currentRoles, storageManagementRoles)) {
      requests.push(settle('storage', api<Paginated<StorageRequest>>(`/storage-requests/admin?${storageQuery}`)));
    }
    if (hasAnyRole(currentRoles, applicationReviewRoles)) {
      requests.push(settle('finance', api<Paginated<FinanceReportRow>>(`/reports/finance?${financeQuery}`)));
    }
    if (hasAnyRole(currentRoles, inspectionManagementRoles)) {
      requests.push(settle('inspection periods', api<InspectionPeriod[]>('/inspections/periods')));
      requests.push(settle('inspections', api<Paginated<Inspection>>(`/inspections?${inspectionQuery}`)));
    }
    if (hasAnyRole(currentRoles, studentRecordRoles)) {
      requests.push(settle('students', api<Paginated<User>>('/users/students?page=1&limit=20')));
    }
    if (hasAnyRole(currentRoles, communicationManagementRoles)) {
      requests.push(settle('communications', api<Paginated<CommunicationRecord>>('/communications?page=1&limit=20')));
    }
    if (hasAnyRole(currentRoles, roomViewRoles)) {
      requests.push(settle('rooms', api<ResidenceRoom[]>('/residence-rooms')));
      if (!hasAnyRole(currentRoles, applicationReviewRoles)) {
        requests.push(settle('residences', api<Residence[]>('/residences')));
      }
    }
    if (currentRoles.includes('ADMINISTRATOR')) {
      requests.push(settle('settings', api<Setting[]>('/settings')));
      requests.push(settle('email templates', api<Template[]>('/settings/email-templates')));
      requests.push(settle('audit logs', api<Paginated<AuditLog>>('/audit-logs?page=1&limit=50')));
    }

    const results = await Promise.all(requests);

    const failures: string[] = [];
    for (const result of results) {
      if (result.status === 'rejected') {
        failures.push(result.label);
        continue;
      }
      switch (result.label) {
        case 'overview statistics':
          setStats(result.value as Stats);
          break;
        case 'applications':
          setApplications(result.value as Paginated<Application>);
          break;
        case 'maintenance':
          setMaintenanceRequests(result.value as Paginated<MaintenanceRequest>);
          break;
        case 'storage':
          setStorageRequests(result.value as Paginated<StorageRequest>);
          break;
        case 'finance':
          setFinanceReport(result.value as Paginated<FinanceReportRow>);
          break;
        case 'inspection periods':
          setInspectionPeriods(result.value as InspectionPeriod[]);
          break;
        case 'inspections':
          setInspections(result.value as Paginated<Inspection>);
          break;
        case 'students':
          setStudents(result.value as Paginated<User>);
          break;
        case 'communications':
          setCommunications(result.value as Paginated<CommunicationRecord>);
          break;
        case 'rooms':
          setResidenceRooms(result.value as ResidenceRoom[]);
          break;
        case 'residences': {
          const residences = (result.value as Residence[]).map((residence) => ({ ...residence, occupiedRooms: 0 }));
          setStats({
            ...emptyStats,
            residences,
            totalRooms: residences.reduce((total, residence) => total + residence.totalRooms, 0),
            availableRooms: residences.reduce((total, residence) => total + residence.availableRooms, 0),
          });
          break;
        }
        case 'settings':
          setSettings(result.value as Setting[]);
          break;
        case 'email templates':
          setTemplates(result.value as Template[]);
          break;
        case 'audit logs':
          setAudit(result.value as Paginated<AuditLog>);
          break;
      }
    }

    if (failures.length) {
      const message = `Could not load ${failures.join(', ')}. The rest of the dashboard is still available.`;
      setLoadError(message);
      toast.error(message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load().catch((error) => {
      const message = error instanceof Error ? error.message : 'Could not load admin dashboard';
      setLoadError(message);
      setLoading(false);
      toast.error(message);
    });
  }, []);

  useEffect(() => {
    const selectTab = (value: string | null | undefined) => {
      if (isAdminTab(value)) setTab(value);
    };
    const selectTabFromLocation = () => {
      selectTab(new URLSearchParams(window.location.search).get('tab'));
    };
    const handleDashboardTab = (event: Event) => {
      const detail = (event as CustomEvent<DashboardTabEventDetail>).detail;
      if (detail?.mode === 'admin') selectTab(detail.tab);
    };

    selectTabFromLocation();
    window.addEventListener('popstate', selectTabFromLocation);
    window.addEventListener('josum:set-dashboard-tab', handleDashboardTab);
    return () => {
      window.removeEventListener('popstate', selectTabFromLocation);
      window.removeEventListener('josum:set-dashboard-tab', handleDashboardTab);
    };
  }, []);

  async function updateApplication(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/applications/admin/${id}/status`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Application updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update application');
    }
  }

  async function updateResidenceRoom(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/residence-rooms/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: form.get('status') }),
      });
      toast.success('Room status updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update room');
    }
  }

  async function updateStudent(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/users/students/${id}/status`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Student updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update student');
    }
  }

  async function terminateStudent(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStudentActionLoading(`terminate:${id}`);
    try {
      await api(`/users/students/${id}/terminate`, {
        method: 'PATCH',
        body: JSON.stringify({ reason: form.get('reason') }),
      });
      toast.success('Student stay terminated');
      setTerminatingStudent(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not terminate student stay');
    } finally {
      setStudentActionLoading('');
    }
  }

  async function whitelistStudent(student: User) {
    const confirmed = window.confirm(`Whitelist ${student.firstName} ${student.lastName} for registration again?`);
    if (!confirmed) return;
    setStudentActionLoading(`whitelist:${student.id}`);
    try {
      await api(`/users/students/${student.id}/whitelist`, { method: 'PATCH' });
      toast.success('Student whitelisted for registration');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not whitelist student');
    } finally {
      setStudentActionLoading('');
    }
  }

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

  async function updateStorage(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/storage-requests/admin/${id}`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Storage request updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update storage request');
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

  async function createInspectionPeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/inspections/periods', { method: 'POST', body: JSON.stringify(compactForm(form)) });
      toast.success('Inspection period created');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create inspection period');
    }
  }

  async function createInspection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const hasPhotos = form.getAll('photos').some((value) => value instanceof File && value.size > 0);
      if (hasPhotos) {
        await upload('/inspections', form);
      } else {
        form.delete('photos');
        await api('/inspections', { method: 'POST', body: JSON.stringify(compactForm(form)) });
      }
      toast.success('Inspection saved');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save inspection');
    }
  }

  async function updateInspection(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/inspections/${id}`, { method: 'PATCH', body: JSON.stringify(compactForm(form)) });
      toast.success('Inspection updated');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update inspection');
    }
  }

  async function upsertSetting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const rawValue = String(form.get('value') ?? '');
    let value: unknown = rawValue;
    try {
      value = JSON.parse(rawValue);
    } catch {
      value = rawValue;
    }
    try {
      await api('/settings', {
        method: 'PUT',
        body: JSON.stringify({ key: form.get('key'), value, description: form.get('description') || undefined }),
      });
      toast.success('Setting saved');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save setting');
    }
  }

  async function upsertTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/settings/email-templates', {
        method: 'PUT',
        body: JSON.stringify({
          key: form.get('key'),
          subject: form.get('subject'),
          body: form.get('body'),
          enabled: form.get('enabled') === 'on',
        }),
      });
      toast.success('Template saved');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save template');
    }
  }

  async function deleteSetting(key: string) {
    try {
      await api(`/settings/${encodeURIComponent(key)}`, { method: 'DELETE' });
      toast.success('Setting deleted');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete setting');
    }
  }

  async function deleteTemplate(key: string) {
    try {
      await api(`/settings/email-templates/${encodeURIComponent(key)}`, { method: 'DELETE' });
      toast.success('Template deleted');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete template');
    }
  }

  async function factoryReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setFactoryResetLoading(true);
    let redirectingAfterReset = false;
    const finishReset = () => {
      redirectingAfterReset = true;
      clearSession();
      window.location.replace('/login?reset=success');
    };
    try {
      await api('/admin/factory-reset', {
        method: 'POST',
        body: JSON.stringify({ recoveryKey: form.get('recoveryKey') }),
      }, false);
      finishReset();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Factory reset failed';
      if (message.toLowerCase().includes('session expired after system reset')) {
        finishReset();
        return;
      }
      toast.error(message);
    } finally {
      if (!redirectingAfterReset) setFactoryResetLoading(false);
    }
  }

  if (loading) {
    return (
      <AppShell mode="admin">
        <div className="grid min-h-80 place-items-center text-sm text-slate-500">
          <RefreshCw className="mb-3 h-5 w-5 animate-spin text-brand" />
          Loading
        </div>
      </AppShell>
    );
  }

  if (!stats) {
    return (
      <AppShell mode="admin">
        <EmptyState title="Dashboard unavailable" body={loadError || 'Could not load the dashboard. Please try again.'} />
      </AppShell>
    );
  }

  const availableTabs = tabs.filter(({ id }) => canAccessTab(id, sessionRoles));
  const activeTab = canAccessTab(tab, sessionRoles) ? tab : availableTabs[0]?.id ?? 'overview';
  const defaultInspectionDate = new Date().toISOString().slice(0, 10);

  return (
    <AppShell mode="admin">
      {loadError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {loadError}
        </div>
      )}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Administration</h1>
          <p className="mt-1 text-sm text-slate-500">Operational dashboard</p>
        </div>
        <div className="flex w-full overflow-x-auto rounded-lg border border-line bg-white p-1 sm:w-auto sm:flex-wrap">
          {availableTabs.map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              type="button"
              title={title}
              onClick={() => setTab(id)}
              className={`focus-ring flex h-9 w-10 shrink-0 items-center justify-center rounded-md ${
                activeTab === id ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile label="Students" value={stats.students} icon={UsersRound} />
            <StatTile label="Applications" value={stats.applications} icon={ClipboardList} />
            <StatTile label="Pending review" value={stats.pendingApplications} icon={History} />
            <StatTile label="Open maintenance" value={stats.openMaintenanceRequests ?? 0} icon={Wrench} />
            <StatTile label="Available rooms" value={`${stats.availableRooms}/${stats.totalRooms}`} icon={Building2} />
          </div>
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-semibold text-ink">Residence occupancy</h2>
                <p className="mt-1 text-sm text-slate-500">Live approved occupancy and availability per building.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {stats.residences.map((residence) => (
                <div key={residence.id} className="rounded-lg border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{residence.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{residence.address}</p>
                    </div>
                    <Building2 className="h-5 w-5 shrink-0 text-brand" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                    <p><span className="text-slate-500">Total</span><br /><strong className="text-lg">{residence.totalRooms}</strong></p>
                    <p><span className="text-slate-500">Available</span><br /><strong className="text-lg text-brand">{residence.availableRooms}</strong></p>
                    <p><span className="text-slate-500">Occupied</span><br /><strong className="text-lg">{residence.occupiedRooms}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-ink">Application status</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {statuses.map((status) => (
                <div key={status} className="rounded-lg border border-line p-3">
                  <StatusBadge status={status} />
                  <p className="mt-3 text-2xl font-bold">{stats.statuses[status] ?? 0}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'applications' && (
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="font-semibold text-ink">Applications</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                load().catch((error) => toast.error(error.message));
              }}
              className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
            >
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm lg:w-72">
                <Search className="h-4 w-4 text-slate-500" />
                <input value={applicationSearch} onChange={(event) => setApplicationSearch(event.target.value)} className="min-w-0 flex-1 outline-none" />
              </label>
              <select
                value={applicationStatus}
                onChange={(event) => setApplicationStatus(event.target.value)}
                className="focus-ring h-10 w-full rounded-lg border border-line px-3 py-2 text-sm sm:w-auto"
              >
                <option value="">All statuses</option>
                {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
              <select
                value={applicationResidence}
                onChange={(event) => setApplicationResidence(event.target.value)}
                className="focus-ring h-10 w-full rounded-lg border border-line px-3 py-2 text-sm sm:w-auto"
              >
                <option value="">All residences</option>
                {stats.residences.map((residence) => (
                  <option key={residence.id} value={residence.id}>{residence.name}</option>
                ))}
              </select>
              <button className="focus-ring h-10 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">Filter</button>
            </form>
          </div>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {applications.items.length ? (
              <table className="w-full min-w-[1240px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-3">Reference</th>
                    <th>Student</th>
                    <th>Room type</th>
                    <th>Residence</th>
                    <th>Status</th>
                    <th>Declaration</th>
                    <th>Documents</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {applications.items.map((application) => (
                    <tr key={application.id} className="align-top">
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedApplication(application)}
                          className="focus-ring rounded-md font-semibold text-accent hover:underline"
                        >
                          {application.referenceCode}
                        </button>
                      </td>
                      <td>{application.user?.firstName} {application.user?.lastName}<br /><span className="text-slate-500">{application.user?.email}</span></td>
                      <td>
                        {application.roomType?.roomTypeName ?? 'Room type not linked'}
                        <br />
                        <span className="text-slate-500">
                          {application.roomType ? `${application.roomType.availableRooms} available` : 'No availability linked'}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold text-ink">{application.residence?.name ?? 'Not linked'}</span>
                        <br />
                        <span className="max-w-52 text-xs text-slate-500">{application.residence?.address}</span>
                        <br />
                        <span className="text-xs font-semibold text-brand">
                          {application.room ? `${application.room.name} - ${application.room.status}` : 'Room not assigned'}
                        </span>
                      </td>
                      <td><StatusBadge status={application.status} /></td>
                      <td>
                        {application.declarationAccepted ? (
                          <div className="grid gap-1 text-xs">
                            <span className="font-semibold text-ink">Signed by {application.electronicSignatureName ?? 'Applicant'}</span>
                            <span className="text-slate-500">ID/Passport: {application.electronicSignatureIdPassport ?? 'Not captured'}</span>
                            <span className="text-slate-500">
                              {application.signedAt ? new Date(application.signedAt).toLocaleString() : 'Signed date not captured'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500">Not signed</span>
                        )}
                      </td>
                      <td>
                        <div className="grid gap-1">
                          {(application.documents ?? []).map((document) => (
                            <button
                              key={document.id}
                              type="button"
                              title={document.originalName}
                              onClick={() => downloadDocument(document.id, document.originalName).catch((error) => toast.error(error.message))}
                              className="grid max-w-[14rem] text-left text-xs text-accent hover:underline"
                            >
                              <span className="truncate font-semibold">{document.originalName}</span>
                              <span className="text-slate-500">{document.type.replaceAll('_', ' ')}</span>
                            </button>
                          ))}
                          {!(application.documents?.length ?? 0) && <span className="text-slate-500">None</span>}
                        </div>
                      </td>
                      <td>
                        <form onSubmit={(event) => updateApplication(event, application.id)} className="grid min-w-64 gap-2">
                          <select name="roomId" defaultValue={application.room?.id ?? ''} className="focus-ring rounded-lg border border-line px-2 py-1.5">
                            <option value="">No individual room assigned</option>
                            {residenceRooms
                              .filter(
                                (room) =>
                                  room.residenceId === application.residence?.id &&
                                  (room.status === 'AVAILABLE' || room.id === application.room?.id) &&
                                  (!application.gender || room.genderAllocation === application.gender),
                              )
                              .map((room) => (
                                <option key={room.id} value={room.id}>
                                  {room.name} - {room.genderAllocation} - {room.roomTypeName}
                                </option>
                              ))}
                          </select>
                          <select name="status" defaultValue={application.status} className="focus-ring rounded-lg border border-line px-2 py-1.5">
                            {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                          </select>
                          <input name="note" placeholder="Status note" className="focus-ring rounded-lg border border-line px-2 py-1.5" />
                          <input name="adminNotes" placeholder="Internal notes" defaultValue={application.adminNotes ?? ''} className="focus-ring rounded-lg border border-line px-2 py-1.5" />
                          <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-slate-50">
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="No applications" body="Applications appear here as students submit them." />
            )}
          </div>
        </section>
      )}

      {activeTab === 'maintenance' && (
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-semibold text-ink">Maintenance complaints</h2>
              <p className="mt-1 text-sm text-slate-500">Move each complaint through Acknowledged, In progress, and Resolved. Students are notified when the stage changes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="w-fit rounded-full border border-line px-3 py-1 text-sm text-slate-600">
                {stats.openMaintenanceRequests ?? 0} active
              </span>
              <span className="w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">
                {maintenanceRequests.items.filter(isMaintenanceSlaBreached).length} SLA breached
              </span>
            </div>
          </div>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {maintenanceRequests.items.length ? (
              <table className="w-full min-w-[1240px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-3">Reference</th>
                    <th>Student</th>
                    <th>Issue</th>
                    <th>Room type / location</th>
                    <th>Priority</th>
                    <th>SLA</th>
                    <th>Business process</th>
                    <th>Resolve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {maintenanceRequests.items.map((request) => (
                    <tr key={request.id} className="align-top">
                      <td className="py-3 font-semibold">{request.referenceCode}</td>
                      <td>
                        {request.user?.firstName} {request.user?.lastName}
                        <br />
                        <span className="text-slate-500">{request.user?.email}</span>
                      </td>
                      <td>
                        <p className="font-semibold text-ink">{request.title}</p>
                        <p className="mt-1 max-w-sm text-slate-600">{request.description}</p>
                        <p className="mt-2 text-xs font-semibold uppercase text-slate-500">{formatEnum(request.category)}</p>
                      </td>
                      <td>
                        {request.roomType?.roomTypeName ?? 'No room type'}
                        <br />
                        <span className="text-slate-500">{request.location || 'No location captured'}</span>
                      </td>
                      <td><MaintenancePriorityBadge priority={request.priority} /></td>
                      <td className="min-w-56">
                        <MaintenanceSlaPanel request={request} compact />
                      </td>
                      <td>
                        <MaintenanceWorkflow status={request.status} />
                      </td>
                      <td>
                        <form onSubmit={(event) => updateMaintenance(event, request.id)} className="grid min-w-72 gap-2">
                          <select
                            name="status"
                            defaultValue={maintenanceWorkflowStatuses.includes(request.status) ? request.status : 'ACKNOWLEDGED'}
                            className="focus-ring rounded-lg border border-line px-2 py-1.5"
                          >
                            {maintenanceWorkflowStatuses.map((status) => (
                              <option key={status} value={status}>{formatEnum(status)}</option>
                            ))}
                          </select>
                          <textarea
                            name="resolutionNote"
                            rows={3}
                            placeholder="Resolution note required when moving to Resolved"
                            defaultValue={request.resolutionNote ?? ''}
                            className="focus-ring rounded-lg border border-line px-2 py-1.5"
                          />
                          <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-slate-50">
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="No maintenance complaints" body="Student complaints and residence maintenance issues will appear here." />
            )}
          </div>
        </section>
      )}

      {activeTab === 'storage' && (
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-semibold text-ink">Student storage requests</h2>
              <p className="mt-1 text-sm text-slate-500">Review forms, item photographs, received dates, released dates, and status history.</p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                load().catch((error) => toast.error(error.message));
              }}
              className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
            >
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm lg:w-72">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={storageSearch}
                  onChange={(event) => setStorageSearch(event.target.value)}
                  className="min-w-0 flex-1 outline-none"
                  placeholder="Search storage"
                />
              </label>
              <select
                value={storageStatus}
                onChange={(event) => setStorageStatus(event.target.value)}
                className="focus-ring h-10 w-full rounded-lg border border-line px-3 py-2 text-sm sm:w-auto"
              >
                <option value="">All statuses</option>
                {storageStatuses.map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
              </select>
              <select
                value={storageResidence}
                onChange={(event) => setStorageResidence(event.target.value)}
                className="focus-ring h-10 w-full rounded-lg border border-line px-3 py-2 text-sm sm:w-auto"
              >
                <option value="">All residences</option>
                {stats.residences.map((residence) => (
                  <option key={residence.id} value={residence.id}>{residence.name}</option>
                ))}
              </select>
              <button className="focus-ring h-10 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">Filter</button>
              <button
                type="button"
                onClick={() => {
                  const query = new URLSearchParams();
                  if (storageSearch) query.set('search', storageSearch);
                  if (storageStatus) query.set('status', storageStatus);
                  if (storageResidence) query.set('residenceId', storageResidence);
                  downloadStorageExport(query.toString()).catch((error) => toast.error(error.message));
                }}
                className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </form>
          </div>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {storageRequests.items.length ? (
              <table className="w-full min-w-[1520px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-3">Reference</th>
                    <th>Student</th>
                    <th>Accommodation</th>
                    <th>Form details</th>
                    <th>Files</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Dates</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {storageRequests.items.map((request) => (
                    <tr key={request.id} className="align-top">
                      <td className="py-3 font-semibold">{request.referenceCode}</td>
                      <td>
                        {request.studentFullName ?? (`${request.user?.firstName ?? ''} ${request.user?.lastName ?? ''}`.trim() || 'No name')}
                        <br />
                        <span className="text-slate-500">{request.studentNumber ?? request.application?.studentNumber ?? request.user?.studentProfile?.studentNumber ?? 'No student number'}</span>
                        <br />
                        <span className="text-slate-500">{request.user?.email}</span>
                      </td>
                      <td>
                        <span className="font-semibold text-ink">{request.residence?.name ?? 'Not linked'}</span>
                        <br />
                        <span className="text-slate-500">{request.room?.name ?? 'No room'}</span>
                      </td>
                      <td>
                        <div className="grid gap-1 text-xs text-slate-600">
                          <span>Form room: {request.studentRoomNumber ?? request.room?.roomNumber ?? request.room?.name ?? 'Not captured'}</span>
                          <span>Site: {request.storageSite ? formatEnum(request.storageSite) : 'Not captured'}</span>
                          <span>Items: {request.numberOfItemsStored ?? 'Not captured'}</span>
                          <span>Student sign: {request.studentSignature ?? 'Not captured'}</span>
                          <span>Manager sign: {request.managementSignature ?? 'Pending'}</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {request.files.map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              title={file.originalName}
                              onClick={() => downloadStorageFile(file.id, file.originalName).catch((error) => toast.error(error.message))}
                              className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {file.fileType === 'FORM' ? 'Form' : 'Photo'}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="max-w-72 whitespace-pre-line text-slate-600">{request.itemDescription || 'No description'}</td>
                      <td><StorageStatusBadge status={request.status} /></td>
                      <td>
                        <div className="grid gap-1 text-xs text-slate-600">
                          <span>Submitted: {formatDateTime(request.submittedAt)}</span>
                          {request.reviewedAt && <span>Reviewed: {formatDateTime(request.reviewedAt)}</span>}
                          {request.receivedAt && <span>Received: {formatDateTime(request.receivedAt)}</span>}
                          {request.releasedAt && <span>Released: {formatDateTime(request.releasedAt)}</span>}
                        </div>
                      </td>
                      <td>
                        <form onSubmit={(event) => updateStorage(event, request.id)} className="grid min-w-72 gap-2">
                          <select name="status" defaultValue={request.status} className="focus-ring rounded-lg border border-line px-2 py-1.5">
                            {storageStatuses.map((status) => (
                              <option key={status} value={status}>{formatEnum(status)}</option>
                            ))}
                          </select>
                          <textarea
                            name="reviewNotes"
                            rows={3}
                            placeholder="Review notes"
                            defaultValue={request.reviewNotes ?? ''}
                            className="focus-ring rounded-lg border border-line px-2 py-1.5"
                          />
                          <input
                            name="managementSignature"
                            maxLength={160}
                            placeholder="Management signature"
                            defaultValue={request.managementSignature ?? ''}
                            className="focus-ring rounded-lg border border-line px-2 py-1.5"
                          />
                          <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-slate-50">
                            <Save className="h-3.5 w-3.5" />
                            Save
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="No storage requests" body="Student storage submissions will appear here after residents upload their forms and item photos." />
            )}
          </div>
        </section>
      )}

      {activeTab === 'finance' && (
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-semibold text-ink">Finance reporting</h2>
              <p className="mt-1 text-sm text-slate-500">Approved, accepted and actively room-assigned residents only.</p>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                load().catch((error) => toast.error(error.message));
              }}
              className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
            >
              <label className="flex min-w-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm lg:w-72">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={financeSearch}
                  onChange={(event) => setFinanceSearch(event.target.value)}
                  className="min-w-0 flex-1 outline-none"
                  placeholder="Search finance"
                />
              </label>
              <select
                value={financeResidence}
                onChange={(event) => setFinanceResidence(event.target.value)}
                className="focus-ring h-10 w-full rounded-lg border border-line px-3 py-2 text-sm sm:w-auto"
              >
                <option value="">All residences</option>
                {stats.residences.map((residence) => (
                  <option key={residence.id} value={residence.id}>{residence.name}</option>
                ))}
              </select>
              <input
                value={financeFundingType}
                onChange={(event) => setFinanceFundingType(event.target.value)}
                placeholder="Funding type"
                className="focus-ring h-10 w-full rounded-lg border border-line px-3 py-2 text-sm sm:w-auto"
              />
              <button className="focus-ring h-10 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white">Filter</button>
              <button
                type="button"
                onClick={() => {
                  const query = new URLSearchParams();
                  if (financeSearch) query.set('search', financeSearch);
                  if (financeResidence) query.set('residenceId', financeResidence);
                  if (financeFundingType) query.set('fundingType', financeFundingType);
                  downloadFinanceExport(query.toString()).catch((error) => toast.error(error.message));
                }}
                className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
            </form>
          </div>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            {financeReport.items.length ? (
              <table className="w-full min-w-[1280px] text-left text-sm">
                <thead className="border-b border-line text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-3">Student</th>
                    <th>ID / Student no.</th>
                    <th>Institution</th>
                    <th>Funding</th>
                    <th>Contact</th>
                    <th>Next of kin</th>
                    <th>Accommodation</th>
                    <th>Dates</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {financeReport.items.map((row) => (
                    <tr key={row.applicationId} className="align-top">
                      <td className="py-3 font-semibold">{row.fullName}<br /><span className="text-xs font-normal text-slate-500">{row.email}</span></td>
                      <td>{row.idNumber}<br /><span className="text-slate-500">{row.studentNumber}</span></td>
                      <td>{row.institution || 'Not captured'}</td>
                      <td>{row.fundingType || 'Not captured'}<br /><span className="text-slate-500">{row.bursaryName}</span></td>
                      <td>{row.studentContactNumber || 'Not captured'}</td>
                      <td>{row.nextOfKinFullName || 'Not captured'}<br /><span className="text-slate-500">{row.nextOfKinContactNumber}</span></td>
                      <td>{row.accommodation}<br /><span className="text-slate-500">{row.roomNumber}</span></td>
                      <td>
                        <div className="grid gap-1 text-xs text-slate-600">
                          <span>Approved: {formatDateTime(row.approvalDate)}</span>
                          <span>Accepted: {formatDateTime(row.acceptanceDate)}</span>
                        </div>
                      </td>
                      <td><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{row.residencyStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="No finance records" body="Approved, accepted and actively assigned residents will appear here." />
            )}
          </div>
        </section>
      )}

      {activeTab === 'inspections' && (
        <div className="grid gap-6">
          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
              <form onSubmit={createInspectionPeriod} className="grid gap-3">
                <div>
                  <h2 className="font-semibold text-ink">Inspection period</h2>
                  <p className="mt-1 text-sm text-slate-500">Create configurable quarterly or custom inspection periods.</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <input name="name" required maxLength={80} placeholder="Quarter 1" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <input name="year" required type="number" min="2020" max="2100" defaultValue={new Date().getFullYear()} className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <input name="startDate" type="date" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <input name="endDate" type="date" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input name="isActive" type="checkbox" defaultChecked className="h-4 w-4 rounded border-line text-brand" />
                  Active period
                </label>
                <button className="focus-ring h-10 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-slate-50">Add period</button>
              </form>

              <form onSubmit={createInspection} className="grid gap-4">
                <div>
                  <h2 className="font-semibold text-ink">Check-in / check-out form</h2>
                  <p className="mt-1 text-sm text-slate-500">Room handover form using the Botlogile check-in and check-out fields.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Period
                    <select name="periodId" required defaultValue={inspectionPeriods[0]?.id ?? ''} className="focus-ring h-10 rounded-lg border border-line bg-white px-3">
                      <option value="">Select period</option>
                      {inspectionPeriods.map((period) => (
                        <option key={period.id} value={period.id}>{period.name} {period.year}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Accommodation
                    <select name="residenceId" required className="focus-ring h-10 rounded-lg border border-line bg-white px-3">
                      <option value="">Select residence</option>
                      {stats.residences.map((residence) => (
                        <option key={residence.id} value={residence.id}>{residence.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Room
                    <select name="roomId" required className="focus-ring h-10 rounded-lg border border-line bg-white px-3">
                      <option value="">Select room</option>
                      {residenceRooms.map((room) => (
                        <option key={room.id} value={room.id}>{stats.residences.find((residence) => residence.id === room.residenceId)?.name ?? 'Residence'} - {room.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Date
                    <input name="inspectionDate" type="date" required defaultValue={defaultInspectionDate} className="focus-ring h-10 rounded-lg border border-line px-3" />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <input name="studentFullName" maxLength={160} placeholder="Full name" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <input name="studentNumber" maxLength={60} placeholder="Student number" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <input name="contactNumber" maxLength={40} placeholder="Contact number" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <input name="emailAddress" maxLength={160} placeholder="Email address" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <input name="keyNumberIssued" maxLength={80} placeholder="Key number issued" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Date in
                    <input name="checkInDate" type="date" className="focus-ring h-10 rounded-lg border border-line px-3" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Date out
                    <input name="checkOutDate" type="date" className="focus-ring h-10 rounded-lg border border-line px-3" />
                  </label>
                </div>
                <input name="occupantNames" maxLength={500} placeholder="Student or occupants, auto-filled when room has an active resident" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                <div className="rounded-lg border border-line p-3">
                  <h3 className="text-sm font-semibold uppercase text-slate-500">Document checklist</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                    {handoverDocumentChecklist.map(([name, label]) => (
                      <label key={name} className="flex items-center gap-2 text-sm font-medium text-ink">
                        <input name={name} type="checkbox" className="h-4 w-4 rounded border-line text-brand" />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <h3 className="text-sm font-semibold uppercase text-slate-500">Area condition</h3>
                  <div className="mt-3 grid gap-2">
                    <div className="grid grid-cols-[minmax(120px,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-xs font-semibold uppercase text-slate-500">
                      <span>Area</span>
                      <span>Move in condition</span>
                      <span>Move out condition</span>
                    </div>
                    {handoverConditionFields.map((field) => (
                      <div key={field.key} className="grid grid-cols-[minmax(120px,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
                        <span className="self-center text-sm font-medium text-ink">{field.label}</span>
                        <input name={handoverFieldName('moveIn', field.key)} maxLength={240} className="focus-ring h-9 rounded-lg border border-line px-2 text-sm" />
                        <input name={handoverFieldName('moveOut', field.key)} maxLength={240} className="focus-ring h-9 rounded-lg border border-line px-2 text-sm" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <h3 className="text-sm font-semibold uppercase text-slate-500">List of items student brought in</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((index) => (
                      <input key={index} name={`itemBroughtIn${index}`} maxLength={200} placeholder={`Item ${index}`} className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Severity
                    <select name="severity" defaultValue="LOW" className="focus-ring h-10 rounded-lg border border-line bg-white px-3">
                      {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((severity) => (
                        <option key={severity} value={severity}>{formatEnum(severity)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Status
                    <select name="status" defaultValue="DRAFT" className="focus-ring h-10 rounded-lg border border-line bg-white px-3">
                      {inspectionStatuses.map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Follow-up date
                    <input name="followUpDate" type="date" className="focus-ring h-10 rounded-lg border border-line px-3" />
                  </label>
                </div>
                <textarea name="damageIdentified" rows={2} maxLength={2000} placeholder="Damage identified" className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" />
                <textarea name="comments" rows={3} maxLength={3000} placeholder="Comments" className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" />
                <textarea name="followUpActions" rows={2} maxLength={2000} placeholder="Follow-up actions" className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" />
                <div className="rounded-lg border border-line p-3">
                  <h3 className="text-sm font-semibold uppercase text-slate-500">Declaration and signatures</h3>
                  <label className="mt-3 flex items-start gap-2 text-sm font-medium text-ink">
                    <input name="studentDeclaration" type="checkbox" className="mt-1 h-4 w-4 rounded border-line text-brand" />
                    Student confirms the room/key and room condition are accurate
                  </label>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <input name="studentSignature" maxLength={160} placeholder="Student signature" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                    <input name="studentSignatureDate" type="date" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                    <input name="managementSignatureIn" maxLength={160} placeholder="Management signature in" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                    <input name="managementSignatureOut" maxLength={160} placeholder="Management signature out" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                    <input name="tenantSignatureIn" maxLength={160} placeholder="Tenant signature in" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                    <input name="tenantSignatureOut" maxLength={160} placeholder="Tenant signature out" className="focus-ring h-10 rounded-lg border border-line px-3 text-sm" />
                  </div>
                </div>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Supporting photographs
                  <input name="photos" type="file" multiple accept="image/jpeg,image/png" className="focus-ring rounded-lg border border-line px-3 py-2 text-sm" />
                </label>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    ['maintenanceRequired', 'Maintenance required'],
                    ['studentAcknowledgement', 'Student acknowledged'],
                    ['inspectorConfirmed', 'Inspector confirmed'],
                    ['studentConfirmed', 'Student confirmed'],
                    ['followUpRequired', 'Follow-up required'],
                  ].map(([name, label]) => (
                    <label key={name} className="flex items-center gap-2 text-sm font-medium text-ink">
                      <input name={name} type="checkbox" className="h-4 w-4 rounded border-line text-brand" />
                      {label}
                    </label>
                  ))}
                </div>
                <button className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white sm:w-auto">
                  <Save className="h-4 w-4" />
                  Save inspection
                </button>
              </form>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-semibold text-ink">Inspection records</h2>
                <p className="mt-1 text-sm text-slate-500">Search, filter, follow up, and export room inspection history.</p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  load().catch((error) => toast.error(error.message));
                }}
                className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]"
              >
                <label className="flex min-w-0 items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm lg:w-72">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    value={inspectionSearch}
                    onChange={(event) => setInspectionSearch(event.target.value)}
                    className="min-w-0 flex-1 outline-none"
                    placeholder="Search inspections"
                  />
                </label>
                <select value={inspectionStatus} onChange={(event) => setInspectionStatus(event.target.value)} className="focus-ring h-10 rounded-lg border border-line px-3 text-sm">
                  <option value="">All statuses</option>
                  {inspectionStatuses.map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
                </select>
                <select value={inspectionPeriod} onChange={(event) => setInspectionPeriod(event.target.value)} className="focus-ring h-10 rounded-lg border border-line px-3 text-sm">
                  <option value="">All periods</option>
                  {inspectionPeriods.map((period) => <option key={period.id} value={period.id}>{period.name} {period.year}</option>)}
                </select>
                <select value={inspectionResidence} onChange={(event) => setInspectionResidence(event.target.value)} className="focus-ring h-10 rounded-lg border border-line px-3 text-sm">
                  <option value="">All residences</option>
                  {stats.residences.map((residence) => <option key={residence.id} value={residence.id}>{residence.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <button className="focus-ring h-10 rounded-lg bg-brand px-3 text-sm font-semibold text-white">Filter</button>
                  <button
                    type="button"
                    onClick={() => {
                      const query = new URLSearchParams();
                      if (inspectionSearch) query.set('search', inspectionSearch);
                      if (inspectionStatus) query.set('status', inspectionStatus);
                      if (inspectionResidence) query.set('residenceId', inspectionResidence);
                      if (inspectionPeriod) query.set('periodId', inspectionPeriod);
                      downloadInspectionExport(query.toString()).catch((error) => toast.error(error.message));
                    }}
                    className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                </div>
              </form>
            </div>
            <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              {inspections.items.length ? (
                <table className="w-full min-w-[1480px] text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-3">Reference</th>
                      <th>Period</th>
                      <th>Room</th>
                      <th>Student / occupants</th>
                      <th>Status</th>
                      <th>Handover</th>
                      <th>Area condition</th>
                      <th>Follow-up</th>
                      <th>Photos</th>
                      <th>Update</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {inspections.items.map((inspection) => (
                      <tr key={inspection.id} className="align-top">
                        <td className="py-3 font-semibold">
                          {inspection.referenceCode}
                          <br />
                          <span className="text-xs font-normal text-slate-500">{formatDateTime(inspection.inspectionDate)}</span>
                        </td>
                        <td>{inspection.period.name}<br /><span className="text-slate-500">{inspection.period.year}</span></td>
                        <td>{inspection.residence.name}<br /><span className="text-slate-500">{inspection.room.name}</span></td>
                        <td>
                          {inspection.studentFullName || inspection.occupantNames || `${inspection.student?.firstName ?? ''} ${inspection.student?.lastName ?? ''}`.trim() || 'No occupant captured'}
                          <br />
                          <span className="text-slate-500">{inspection.studentNumber ?? inspection.student?.studentProfile?.studentNumber ?? inspection.student?.email ?? ''}</span>
                          <br />
                          <span className="text-slate-500">{inspection.contactNumber ?? inspection.emailAddress ?? ''}</span>
                        </td>
                        <td>
                          <InspectionStatusBadge status={inspection.status} />
                          <p className="mt-2 text-xs text-slate-500">{formatEnum(inspection.severity)}</p>
                        </td>
                        <td>
                          <div className="grid max-w-sm gap-1 text-xs text-slate-600">
                            <span>Key: {inspection.keyNumberIssued ?? 'Not captured'}</span>
                            <span>Date in: {formatDateTime(inspection.checkInDate) ?? 'Not captured'}</span>
                            <span>Date out: {formatDateTime(inspection.checkOutDate) ?? 'Not captured'}</span>
                            <span>Docs: {handoverDocumentChecklist.filter(([name]) => inspection[name]).length}/{handoverDocumentChecklist.length}</span>
                            <span>Items: {inspection.itemsBroughtIn?.length ? inspection.itemsBroughtIn.join(', ') : 'None'}</span>
                          </div>
                        </td>
                        <td>
                          <div className="grid max-w-sm gap-1 text-xs text-slate-600">
                            {handoverConditionFields.slice(0, 6).map((field) => (
                              <span key={field.key}>
                                {field.label}: {conditionValue(inspection.moveInConditions, field.key) || 'In -'} / {conditionValue(inspection.moveOutConditions, field.key) || 'Out -'}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="max-w-72 whitespace-pre-line text-slate-600">
                          {inspection.followUpRequired ? inspection.followUpActions || 'Follow-up required' : 'No follow-up'}
                          {inspection.followUpDate && <p className="mt-1 text-xs text-slate-500">{formatDateTime(inspection.followUpDate)}</p>}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-2">
                            {inspection.attachments.map((file) => (
                              <button
                                key={file.id}
                                type="button"
                                title={file.originalName}
                                onClick={() => downloadInspectionAttachment(file.id, file.originalName).catch((error) => toast.error(error.message))}
                                className="focus-ring inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2 text-xs font-semibold hover:bg-slate-50"
                              >
                                <Download className="h-3.5 w-3.5" />
                                Photo
                              </button>
                            ))}
                            {!inspection.attachments.length && <span className="text-xs text-slate-500">None</span>}
                          </div>
                        </td>
                        <td>
                          <form onSubmit={(event) => updateInspection(event, inspection.id)} className="grid min-w-72 gap-2">
                            <select name="status" defaultValue={inspection.status} className="focus-ring rounded-lg border border-line px-2 py-1.5">
                              {inspectionStatuses.map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
                            </select>
                            <input name="checkOutDate" type="date" defaultValue={inspection.checkOutDate?.slice(0, 10) ?? ''} className="focus-ring rounded-lg border border-line px-2 py-1.5" />
                            <input name="managementSignatureOut" defaultValue={inspection.managementSignatureOut ?? ''} placeholder="Management signature out" className="focus-ring rounded-lg border border-line px-2 py-1.5" />
                            <input name="tenantSignatureOut" defaultValue={inspection.tenantSignatureOut ?? ''} placeholder="Tenant signature out" className="focus-ring rounded-lg border border-line px-2 py-1.5" />
                            <textarea name="comments" rows={2} defaultValue={inspection.comments ?? ''} placeholder="Comments" className="focus-ring rounded-lg border border-line px-2 py-1.5" />
                            <textarea name="followUpActions" rows={2} defaultValue={inspection.followUpActions ?? ''} placeholder="Follow-up actions" className="focus-ring rounded-lg border border-line px-2 py-1.5" />
                            <label className="flex items-center gap-2 text-xs font-medium text-ink">
                              <input name="inspectorConfirmed" type="checkbox" defaultChecked={inspection.inspectorConfirmed} className="h-4 w-4 rounded border-line text-brand" />
                              Inspector confirmed
                            </label>
                            <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-slate-50">
                              <Save className="h-3.5 w-3.5" />
                              Save
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="No inspections" body="Room inspection records will appear here after they are captured." />
              )}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'rooms' && (
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-ink">Room management</h2>
            <span className="w-fit rounded-full border border-line px-3 py-1 text-sm text-slate-600">
              {stats.availableRooms}/{stats.totalRooms} rooms available
            </span>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {stats.residences.map((residence) => (
              <div key={residence.id} className="rounded-lg border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-ink">{residence.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{residence.residenceType}</p>
                  </div>
                  <span className="rounded-full border border-brand/20 bg-teal-50 px-3 py-1 text-sm font-semibold text-brand">
                    {residence.availableRooms} available
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <p><span className="text-slate-500">Total</span><br />{residence.totalRooms}</p>
                  <p><span className="text-slate-500">Available</span><br />{residence.availableRooms}</p>
                  <p><span className="text-slate-500">Approved</span><br />{residence.occupiedRooms}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Individual room inventory</h3>
            <p className="mt-1 text-sm text-slate-500">
              Update availability, reservations, occupancy, and maintenance status for every numbered room.
            </p>
          </div>
          <div className="mt-4 grid gap-6">
            {stats.residences.map((residence) => (
              <div key={residence.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-ink">{residence.name}</h4>
                  <span className="text-sm text-slate-500">
                    {residenceRooms.filter((room) => room.residenceId === residence.id && room.status === 'AVAILABLE').length} individually available
                  </span>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {residenceRooms
                    .filter((room) => room.residenceId === residence.id)
                    .map((room) => hasAnyRole(sessionRoles, roomManagementRoles) ? (
                      <form
                        key={room.id}
                        onSubmit={(event) => updateResidenceRoom(event, room.id)}
                        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-line py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{room.name}</p>
                          <p className="truncate text-xs text-slate-500">{room.genderAllocation} - {room.roomTypeName}</p>
                          <select
                            name="status"
                            defaultValue={room.status}
                            className="focus-ring mt-2 h-9 w-full rounded-md border border-line bg-white px-2 text-xs"
                          >
                            <option value="AVAILABLE">Available</option>
                            <option value="RESERVED">Reserved</option>
                            <option value="OCCUPIED">Occupied</option>
                            <option value="MAINTENANCE">Maintenance</option>
                          </select>
                        </div>
                        <button
                          className="focus-ring mt-auto grid h-9 w-9 place-items-center rounded-md border border-line text-brand hover:bg-teal-50"
                          aria-label={`Save ${room.name}`}
                          title={`Save ${room.name}`}
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <div key={room.id} className="grid gap-1 border-b border-line py-2">
                        <p className="truncate text-sm font-semibold text-ink">{room.name}</p>
                        <p className="truncate text-xs text-slate-500">{room.genderAllocation} - {room.roomTypeName}</p>
                        <span className="w-fit rounded-full border border-line px-2 py-1 text-xs text-slate-600">{formatEnum(room.status)}</span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-sm font-semibold uppercase text-slate-500">Room category</h3>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-line py-3">
            <div>
              <p className="font-semibold text-ink">Single Room</p>
              <p className="mt-1 text-sm text-slate-500">The only room category at Josum 1 and Josum 2.</p>
            </div>
            <p className="text-sm font-medium text-ink">
              {stats?.availableRooms ?? 0} of {stats?.totalRooms ?? 0} available
            </p>
          </div>
        </section>
      )}

      {activeTab === 'students' && (
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Students</h2>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-3">Name</th>
                  <th>Email</th>
                  <th>Account</th>
                  <th>Student number</th>
                  <th>Stay</th>
                  <th>Registration</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {students.items.map((student) => (
                  <tr key={student.id}>
                    <td className="py-3 font-semibold">{student.firstName} {student.lastName}</td>
                    <td>{student.email}</td>
                    <td>
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${
                        student.status === 'ACTIVE'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}>
                        {formatEnum(student.status)}
                      </span>
                    </td>
                    <td>{String(student.studentProfile?.studentNumber ?? '')}</td>
                    <td>
                      {student.latestStay ? (
                        <div className="grid gap-1">
                          <span className={`w-fit rounded-full border px-2 py-1 text-xs font-semibold ${
                            student.latestStay.stayStatus === 'TERMINATED'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}>
                            {formatEnum(student.latestStay.stayStatus)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {joinDetails(student.latestStay.residenceName, student.latestStay.roomName)}
                          </span>
                          {student.latestStay.terminatedAt && (
                            <span className="text-xs text-slate-500">Terminated: {formatDateTime(student.latestStay.terminatedAt)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">No accepted stay</span>
                      )}
                    </td>
                    <td>
                      {student.isRegistrationBlocked ? (
                        <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
                          Blocked
                        </span>
                      ) : student.registrationBlocks?.some((block) => block.whitelistedAt) ? (
                        <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          Whitelisted
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full border border-line px-2 py-1 text-xs font-semibold text-slate-600">
                          Open
                        </span>
                      )}
                    </td>
                    <td>
                      {sessionRoles.includes('ADMINISTRATOR') ? (
                        <div className="flex flex-wrap gap-2">
                          <form onSubmit={(event) => updateStudent(event, student.id)} className="flex gap-2">
                            <select name="status" defaultValue={student.status} className="focus-ring rounded-lg border border-line px-2 py-1.5">
                              <option value="ACTIVE">Active</option>
                              <option value="SUSPENDED">Suspended</option>
                            </select>
                            <button
                              title="Save account status"
                              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line font-semibold hover:bg-slate-50"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                          </form>
                          {student.latestStay?.stayStatus === 'ACTIVE' && student.latestStay.status === 'APPROVED' && (
                            <button
                              type="button"
                              title="Terminate stay"
                              onClick={() => setTerminatingStudent(student)}
                              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                            >
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                          {student.isRegistrationBlocked && (
                            <button
                              type="button"
                              title="Whitelist student registration"
                              disabled={studentActionLoading === `whitelist:${student.id}`}
                              onClick={() => whitelistStudent(student)}
                              className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">Admin only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!students.items.length && <EmptyState title="No students" body="Student records will appear here after registration." />}
          </div>
        </section>
      )}

      {activeTab === 'communications' && (
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <div className="grid gap-6 xl:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
            <form onSubmit={sendCommunication} className="grid gap-4">
              <div>
                <h2 className="font-semibold text-ink">Maintenance communication</h2>
                <p className="mt-1 text-sm text-slate-500">Send notices only to active residents with accepted room assignments.</p>
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
                  {stats.residences.map((residence) => <option key={residence.id} value={residence.id}>{residence.name}</option>)}
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
              <h2 className="font-semibold text-ink">Communication history</h2>
              <div className="mt-4 grid gap-3">
                {communications.items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-semibold text-ink">{item.subject}</p>
                      <span className="rounded-full border border-line px-2 py-1 text-xs">{formatEnum(item.type)}</span>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-slate-600">{item.message}</p>
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
      )}

      {activeTab === 'settings' && (
        <div className="grid gap-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <form onSubmit={upsertSetting} className="rounded-lg border border-line bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-ink">System setting</h2>
              <div className="mt-4 grid gap-3">
                <input name="key" placeholder="Key" required className="focus-ring rounded-lg border border-line px-3 py-2" />
                <textarea name="value" rows={5} placeholder='{"enabled": true}' required className="focus-ring rounded-lg border border-line px-3 py-2" />
                <input name="description" placeholder="Description" className="focus-ring rounded-lg border border-line px-3 py-2" />
                <button className="focus-ring rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">Save setting</button>
              </div>
            </form>
            <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-ink">Settings</h2>
              <div className="mt-4 grid gap-3">
                {settings.map((setting) => (
                  <div key={setting.id} className="rounded-lg border border-line p-3 text-sm">
                    <p className="font-semibold">{setting.key}</p>
                    <pre className="mt-2 max-w-full overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs">{JSON.stringify(setting.value, null, 2)}</pre>
                    <button
                      type="button"
                      onClick={() => deleteSetting(setting.key)}
                      className="focus-ring mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex max-w-3xl gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <h2 className="font-semibold text-red-950">Factory Reset System</h2>
                  <p className="mt-1 text-sm text-red-800">
                    This permanently removes students, Manager, Security, and Technician accounts, applications, documents, notifications, emails, audit logs, and operational records. Administrator accounts, roles, settings, templates, and room setup are preserved.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFactoryResetOpen((value) => !value)}
                className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 hover:bg-red-100 sm:w-fit"
              >
                <RotateCcw className="h-4 w-4" />
                Factory Reset System
              </button>
            </div>

            {factoryResetOpen && (
              <form onSubmit={factoryReset} className="mt-4 grid gap-3 border-t border-red-200 pt-4 md:grid-cols-[1fr_auto] md:items-end">
                <label className="grid gap-1 text-sm font-medium text-red-950">
                  Recovery key
                  <input
                    name="recoveryKey"
                    type="password"
                    required
                    autoComplete="off"
                  className="focus-ring h-11 w-full rounded-lg border border-red-300 bg-white px-3 text-ink"
                  />
                </label>
                <button
                  disabled={factoryResetLoading}
                  className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60 md:w-auto"
                >
                  <AlertTriangle className="h-4 w-4" />
                  {factoryResetLoading ? 'Resetting' : 'Confirm reset'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <form onSubmit={upsertTemplate} className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-ink">Email template</h2>
            <div className="mt-4 grid gap-3">
              <input name="key" placeholder="Template key" required className="focus-ring rounded-lg border border-line px-3 py-2" />
              <input name="subject" placeholder="Subject" required className="focus-ring rounded-lg border border-line px-3 py-2" />
              <textarea name="body" rows={8} placeholder="Body" required className="focus-ring rounded-lg border border-line px-3 py-2" />
              <label className="flex items-center gap-2 text-sm font-medium">
                <input name="enabled" type="checkbox" defaultChecked className="h-4 w-4 rounded border-line text-brand" />
                Enabled
              </label>
              <button className="focus-ring rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white">Save template</button>
            </div>
          </form>
          <section className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <h2 className="font-semibold text-ink">Templates</h2>
            <div className="mt-4 grid gap-3">
              {templates.map((template) => (
                <div key={template.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{template.key}</p>
                    <span className="rounded-full border border-line px-2 py-1 text-xs">{template.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <p className="mt-2 font-medium">{template.subject}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-slate-600">{template.body}</p>
                  <button
                    type="button"
                    onClick={() => deleteTemplate(template.key)}
                    className="focus-ring mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'audit' && (
        <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
          <h2 className="font-semibold text-ink">Audit logs</h2>
          <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-slate-500">
                <tr><th className="py-3">Action</th><th>Entity</th><th>Actor</th><th>Time</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 font-semibold">{item.action}</td>
                    <td>{item.entity} {item.entityId && <span className="text-slate-500">{item.entityId}</span>}</td>
                    <td>{item.actor?.email ?? 'System'}</td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selectedApplication && (
        <ApplicationDetailsModal
          application={selectedApplication}
          onClose={() => setSelectedApplication(null)}
        />
      )}

      {terminatingStudent && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-6">
          <form
            onSubmit={(event) => terminateStudent(event, terminatingStudent.id)}
            className="w-full max-w-xl rounded-lg bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-ink">Terminate Stay</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {terminatingStudent.firstName} {terminatingStudent.lastName} - {terminatingStudent.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTerminatingStudent(null)}
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-slate-600 hover:bg-slate-50"
                aria-label="Close termination form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="mt-4 grid gap-1 text-sm font-medium text-ink">
              Termination note
              <textarea
                name="reason"
                required
                maxLength={2000}
                rows={5}
                className="focus-ring rounded-lg border border-line px-3 py-2"
              />
            </label>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setTerminatingStudent(null)}
                className="focus-ring inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={studentActionLoading === `terminate:${terminatingStudent.id}`}
                className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {studentActionLoading === `terminate:${terminatingStudent.id}` ? 'Terminating' : 'Confirm termination'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function ApplicationDetailsModal({ application, onClose }: { application: Application; onClose(): void }) {
  const toast = useToast();
  const studentName = `${application.user?.firstName ?? ''} ${application.user?.lastName ?? ''}`.trim() || 'Student not linked';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-line p-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-500">Application reference</p>
            <h2 className="mt-1 break-words text-xl font-bold text-ink">{application.referenceCode}</h2>
            <p className="mt-1 text-sm text-slate-500">{studentName} - {application.user?.email ?? 'No email captured'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line text-slate-600 hover:bg-slate-50"
            aria-label="Close application details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <DetailSection title="Application summary">
              <DetailField label="Status" value={formatEnum(application.status)} />
              <DetailField label="Residence" value={application.residence?.name} />
              <DetailField label="Residence address" value={application.residence?.address} wide />
              <DetailField label="Assigned / preferred room" value={application.room ? `${application.room.name} - ${application.room.status}` : 'Not assigned'} />
              <DetailField label="Room required" value={application.roomType?.roomTypeName} />
              <DetailField label="Residence availability" value={application.residence ? `${application.residence.availableRooms} of ${application.residence.totalRooms}` : undefined} />
              <DetailField label="NWU Vaal student" value={application.isNwuStudent ? 'Yes' : 'No'} />
              <DetailField label="Year of study" value={application.studyYear} />
              <DetailField label="Semester" value={application.studySemester} />
              <DetailField label="Applicant type" value={application.returningStudent ? 'Returning student' : 'New student'} />
              <DetailField label="Submitted" value={formatDateTime(application.createdAt)} />
              <DetailField label="Date of occupation" value={formatDate(application.dateOfOccupation)} />
              <DetailField label="Payment term" value={application.paymentTerm} />
              <DetailField label="Funding type" value={application.fundingType} />
            </DetailSection>

            <DetailSection title="Personal and institution details">
              <DetailField label="Student" value={studentName} />
              <DetailField label="Application name" value={`${application.applicantFirstName ?? ''} ${application.applicantLastName ?? ''}`.trim()} />
              <DetailField label="Student identity number" value={application.studentIdNumber} />
              <DetailField label="Student number" value={application.studentNumber} />
              <DetailField label="Student phone" value={application.studentPhone} />
              <DetailField label="Email" value={application.user?.email} />
              <DetailField label="Phone" value={application.user?.phone} />
              <DetailField label="Nationality" value={application.nationality} />
              <DetailField label="Gender" value={application.gender} />
              <DetailField label="Postal code" value={application.postalCode} />
              <DetailField label="Name of institution" value={application.institutionName} />
              <DetailField label="Name of course" value={application.courseName} />
              <DetailField label="Student advisor details" value={application.studentAdvisorDetails} wide />
            </DetailSection>

            <DetailSection title="Guarantor details">
              <DetailField label="Full names" value={application.guarantorFullName} />
              <DetailField label="ID / Passport no" value={application.guarantorIdPassport} />
              <DetailField label="Cell no" value={application.guarantorCell} />
              <DetailField label="Email address" value={application.guarantorEmail} />
              <DetailField label="Nationality" value={application.guarantorNationality} />
              <DetailField label="Employer" value={application.guarantorEmployer} />
              <DetailField label="Physical address" value={application.guarantorAddress} wide />
            </DetailSection>

            <DetailSection title="Next of kin and emergency">
              <DetailField label="Next of kin 1" value={joinDetails(application.nextOfKin1Name, application.nextOfKin1Relationship, application.nextOfKin1Cell)} />
              <DetailField label="Next of kin 2" value={joinDetails(application.nextOfKin2Name, application.nextOfKin2Relationship, application.nextOfKin2Cell)} />
              <DetailField label="Next of kin 3" value={joinDetails(application.nextOfKin3Name, application.nextOfKin3Relationship, application.nextOfKin3Cell)} />
              <DetailField label="Medical details" value={application.medicalDetails} wide />
              <DetailField label="Medical condition declared" value={application.hasMedicalConditions ? 'Yes' : 'No'} />
              <DetailField label="Funding reference / bursary" value={application.fundingReference} wide />
              <DetailField label="Additional information" value={application.additionalInformation} wide />
              <DetailField label="Special requirements" value={application.specialRequirements} wide />
            </DetailSection>

            <DetailSection title="Declaration and signature">
              <DetailField label="Terms accepted" value={application.termsAccepted ? 'Yes' : 'No'} />
              <DetailField label="Declaration accepted" value={application.declarationAccepted ? 'Yes' : 'No'} />
              <DetailField label="Electronic signature name" value={application.electronicSignatureName} />
              <DetailField label="ID / Passport signed with" value={application.electronicSignatureIdPassport} />
              <DetailField label="Signed at" value={formatDateTime(application.signedAt)} />
              {application.signatureDataUrl ? (
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase text-slate-500">Drawn signature</p>
                  <div className="mt-1 rounded-lg border border-line bg-slate-50 p-2">
                    <Image
                      src={application.signatureDataUrl}
                      alt="Applicant drawn signature"
                      width={360}
                      height={112}
                      unoptimized
                      className="h-28 max-w-full object-contain"
                    />
                  </div>
                </div>
              ) : (
                <DetailField label="Drawn signature" value="Not captured" wide />
              )}
            </DetailSection>

            <DetailSection title="Documents">
              {(application.documents ?? []).length ? (
                <div className="grid gap-2 md:col-span-2">
                  {(application.documents ?? []).map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => downloadDocument(document.id, document.originalName).catch((error) => toast.error(error.message))}
                      className="focus-ring flex flex-col gap-1 rounded-lg border border-line p-3 text-left text-sm hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="break-words font-semibold text-accent">{document.originalName}</span>
                      <span className="text-xs font-semibold uppercase text-slate-500">{formatEnum(document.type)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <DetailField label="Uploaded documents" value="None" wide />
              )}
            </DetailSection>

            <DetailSection title="Admin notes and history">
              <DetailField label="Internal notes" value={application.adminNotes} wide />
              <div className="grid gap-2 md:col-span-2">
                {(application.statusHistory ?? []).map((history) => (
                  <div key={history.id} className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={history.toStatus} />
                      <span className="text-slate-500">{formatDateTime(history.createdAt)}</span>
                    </div>
                    {history.note && <p className="mt-2 text-slate-600">{history.note}</p>}
                  </div>
                ))}
                {!(application.statusHistory?.length ?? 0) && <p className="text-sm text-slate-500">No status history captured.</p>}
              </div>
            </DetailSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line p-3 sm:p-4">
      <h3 className="text-sm font-semibold uppercase text-slate-500">{title}</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function DetailField({ label, value, wide = false }: { label: string; value?: string | number | null; wide?: boolean }) {
  const displayValue = value === undefined || value === null || value === '' ? 'Not captured' : value;
  return (
    <div className={wide ? 'md:col-span-2' : undefined}>
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">{displayValue}</p>
    </div>
  );
}

function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  const classes: Record<MaintenanceStatus, string> = {
    OPEN: 'border-blue-200 bg-blue-50 text-blue-700',
    ACKNOWLEDGED: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
    RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    CLOSED: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>
      {formatEnum(status)}
    </span>
  );
}

function StorageStatusBadge({ status }: { status: StorageRequestStatus }) {
  const classes: Record<StorageRequestStatus, string> = {
    DRAFT: 'border-slate-200 bg-slate-50 text-slate-600',
    SUBMITTED: 'border-blue-200 bg-blue-50 text-blue-700',
    UNDER_REVIEW: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    REJECTED: 'border-red-200 bg-red-50 text-red-700',
    ITEMS_RECEIVED: 'border-violet-200 bg-violet-50 text-violet-700',
    RELEASE_REQUESTED: 'border-amber-200 bg-amber-50 text-amber-700',
    ITEMS_RELEASED: 'border-slate-200 bg-slate-100 text-slate-700',
    CANCELLED: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>
      {formatEnum(status)}
    </span>
  );
}

function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  const classes: Record<InspectionStatus, string> = {
    DRAFT: 'border-slate-200 bg-slate-50 text-slate-600',
    COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    FOLLOW_UP_REQUIRED: 'border-amber-200 bg-amber-50 text-amber-700',
    CLOSED: 'border-slate-200 bg-slate-100 text-slate-700',
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>
      {formatEnum(status)}
    </span>
  );
}

function handoverFieldName(prefix: 'moveIn' | 'moveOut', key: string) {
  return `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}

function conditionValue(conditions: Record<string, string> | null | undefined, key: string) {
  return conditions?.[key] ?? '';
}

function MaintenanceWorkflow({ status }: { status: MaintenanceStatus }) {
  const stageIndex = maintenanceWorkflowStatuses.indexOf(status);
  return (
    <div className="grid min-w-64 gap-2">
      <div className="flex flex-wrap gap-2">
        {maintenanceWorkflowStatuses.map((stage, index) => {
          const isActive = status === stage;
          const isComplete = stageIndex >= 0 && index < stageIndex;
          return (
            <span
              key={stage}
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                isActive
                  ? 'border-brand/30 bg-teal-50 text-brand'
                  : isComplete
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              {formatEnum(stage)}
            </span>
          );
        })}
      </div>
      <MaintenanceStatusBadge status={status} />
    </div>
  );
}

function MaintenancePriorityBadge({ priority }: { priority: MaintenanceRequest['priority'] }) {
  const classes: Record<MaintenanceRequest['priority'], string> = {
    LOW: 'border-slate-200 bg-slate-50 text-slate-600',
    MEDIUM: 'border-sky-200 bg-sky-50 text-sky-700',
    HIGH: 'border-amber-200 bg-amber-50 text-amber-700',
    URGENT: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[priority]}`}>
      {formatEnum(priority)}
    </span>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString() : undefined;
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : undefined;
}

function joinDetails(...values: Array<string | undefined | null>) {
  const captured = values.filter(Boolean);
  return captured.length ? captured.join(' - ') : undefined;
}

async function settle<T>(label: string, promise: Promise<T>): Promise<DashboardLoadResult> {
  try {
    return { label, status: 'fulfilled', value: await promise };
  } catch (error) {
    return { label, status: 'rejected', reason: error };
  }
}

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isAdminTab(value: string | null | undefined): value is Tab {
  return tabs.some((item) => item.id === value);
}

function canAccessTab(tab: Tab, roles: string[]) {
  switch (tab) {
    case 'overview':
      return hasAnyRole(roles, staffPortalRoles);
    case 'applications':
      return hasAnyRole(roles, applicationReviewRoles);
    case 'maintenance':
      return hasAnyRole(roles, maintenanceWorkflowRoles);
    case 'storage':
      return hasAnyRole(roles, storageManagementRoles);
    case 'finance':
      return hasAnyRole(roles, applicationReviewRoles);
    case 'inspections':
      return hasAnyRole(roles, inspectionManagementRoles);
    case 'rooms':
      return hasAnyRole(roles, roomViewRoles);
    case 'students':
      return hasAnyRole(roles, studentRecordRoles);
    case 'communications':
      return hasAnyRole(roles, communicationManagementRoles);
    case 'settings':
    case 'templates':
    case 'audit':
      return roles.includes('ADMINISTRATOR');
    default:
      return false;
  }
}

function hasAnyRole(userRoles: string[], allowedRoles: string[]) {
  return allowedRoles.some((role) => userRoles.includes(role));
}
