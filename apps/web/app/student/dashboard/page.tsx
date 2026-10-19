'use client';

import NextImage from 'next/image';
import { FormEvent, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Archive, Building2, Check, Clock3, Download, FileUp, Home, MapPin, PenLine, RefreshCw, Save, Send, Trash2, UserPlus, UserRound, Wrench, X, type LucideIcon } from 'lucide-react';
import { AppShell, EmptyState, StatTile } from '@/components/AppShell';
import { MaintenanceSlaPanel } from '@/components/MaintenanceSlaPanel';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/components/ToastProvider';
import { api, compactForm, downloadDocument, downloadStorageFile, downloadStorageFormTemplate, getSession, upload } from '@/lib/api';
import { dashboardPathForRoles } from '@/lib/role-routing';
import type { Application, DocumentRecord, MaintenanceCategory, MaintenancePriority, MaintenanceRequest, MaintenanceStatus, NotificationRecord, Residence, ResidenceRoom, RoomType, StorageRequest, User, VisitorPreRegistration } from '@/lib/types';

type Tab = 'overview' | 'apply' | 'maintenance' | 'visitors' | 'storage' | 'documents' | 'profile';
const tabs: Array<{ id: Tab; icon: LucideIcon; title: string }> = [
  { id: 'overview', icon: Home, title: 'Overview' },
  { id: 'apply', icon: Send, title: 'Apply' },
  { id: 'maintenance', icon: Wrench, title: 'Maintenance' },
  { id: 'visitors', icon: UserPlus, title: 'Visitors' },
  { id: 'storage', icon: Archive, title: 'Storage' },
  { id: 'documents', icon: FileUp, title: 'Documents' },
  { id: 'profile', icon: UserRound, title: 'Profile' },
];

type DashboardTabEventDetail = { mode?: 'student' | 'admin'; tab?: string };

const maintenanceCategories: MaintenanceCategory[] = ['PLUMBING', 'ELECTRICAL', 'FURNITURE', 'CLEANING', 'INTERNET', 'SECURITY', 'OTHER'];
const maintenancePriorities: MaintenancePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
type ApplicationDraft = Record<string, string>;
type DocumentTypeValue = DocumentRecord['type'];

const APPLICATION_DRAFT_STORAGE_KEY = 'josum.applicationDraft.v1';
const documentTypeOptions: ReadonlyArray<readonly [DocumentTypeValue, string]> = [
  ['STUDENT_ID_COPY', 'Student ID Copy'],
  ['PROOF_OF_FUNDING', 'Proof of funding'],
  ['PARENT_ID_COPY', 'Parent ID Copy'],
  ['ACADEMIC_RECORD', 'Academic record'],
  ['ACCEPTANCE_LETTER', 'Acceptance letter'],
  ['PROOF_OF_REGISTRATION', 'Proof of registration'],
] as const;
const documentTypeLabels: Partial<Record<DocumentTypeValue, string>> = {
  ...Object.fromEntries(documentTypeOptions),
  ID_DOCUMENT: 'Student ID Copy',
  APPLICANT_ID_PASSPORT: 'Student ID Copy',
  STUDENT_ACCEPTANCE_LETTER: 'Acceptance letter',
  GUARANTOR_SUPPORTING_DOCUMENTS: 'Parent ID Copy',
  PROOF_OF_PAYMENT: 'Proof of payment',
  STUDENT_COLOR_ID_PHOTOS: 'Student color ID photos',
  MEDICAL_AID_CERTIFICATE: 'Medical Aid Certificate',
  OTHER: 'Other',
};
const storageSiteOptions = [
  ['JOSUM_ONE', 'Josum One'],
  ['JOSUM_TWO', 'Josum Two'],
] as const;

export default function StudentDashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<User | null>(null);
  const [residences, setResidences] = useState<Residence[]>([]);
  const [residenceRooms, setResidenceRooms] = useState<ResidenceRoom[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [visitorPreRegistrations, setVisitorPreRegistrations] = useState<VisitorPreRegistration[]>([]);
  const [storageRequests, setStorageRequests] = useState<StorageRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [applicationSubmitting, setApplicationSubmitting] = useState(false);
  const [storageSubmitting, setStorageSubmitting] = useState(false);
  const [storageReleaseSubmittingId, setStorageReleaseSubmittingId] = useState('');
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [selectedResidenceId, setSelectedResidenceId] = useState('');
  const [applicationGender, setApplicationGender] = useState('');
  const [applicantCategory, setApplicantCategory] = useState('NEW_STUDENT');
  const [returningStudent, setReturningStudent] = useState(false);
  const [applicationDraft, setApplicationDraft] = useState<ApplicationDraft | null>(null);
  const [applicationDraftReady, setApplicationDraftReady] = useState(false);
  const [documentApplicationId, setDocumentApplicationId] = useState('');
  const applicationFormRef = useRef<HTMLFormElement>(null);

  async function load() {
    const session = getSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!session.user.roles.includes('STUDENT')) {
      router.replace(dashboardPathForRoles(session.user.roles));
      return;
    }
    const [
      profile,
      nextResidences,
      nextResidenceRooms,
      nextRoomTypes,
      myApplications,
      myMaintenanceRequests,
      myVisitorPreRegistrations,
      myStorageRequests,
      myNotifications,
    ] = await Promise.all([
      api<User>('/auth/me'),
      api<Residence[]>('/residences'),
      api<ResidenceRoom[]>('/residence-rooms'),
      api<RoomType[]>('/room-types'),
      api<Application[]>('/applications/mine'),
      api<MaintenanceRequest[]>('/maintenance/mine'),
      api<VisitorPreRegistration[]>('/security/visitor-pre-registrations/mine'),
      api<StorageRequest[]>('/storage-requests/mine'),
      api<NotificationRecord[]>('/notifications'),
    ]);
    setMe(profile);
    setResidences(nextResidences);
    setResidenceRooms(nextResidenceRooms);
    setRoomTypes(nextRoomTypes);
    setApplications(myApplications);
    setMaintenanceRequests(myMaintenanceRequests);
    setVisitorPreRegistrations(myVisitorPreRegistrations);
    setStorageRequests(myStorageRequests);
    setNotifications(myNotifications);
    setLoading(false);
  }

  useEffect(() => {
    load().catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load dashboard'));
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const selectTab = (value: string | null | undefined) => {
      if (isStudentTab(value)) setTab(value);
    };
    const selectTabFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      selectTab(params.get('tab'));
      const residenceId = params.get('residenceId');
      if (residenceId) setSelectedResidenceId(residenceId);
    };
    const handleDashboardTab = (event: Event) => {
      const detail = (event as CustomEvent<DashboardTabEventDetail>).detail;
      if (detail?.mode === 'student') selectTab(detail.tab);
    };

    selectTabFromLocation();
    window.addEventListener('popstate', selectTabFromLocation);
    window.addEventListener('josum:set-dashboard-tab', handleDashboardTab);
    return () => {
      window.removeEventListener('popstate', selectTabFromLocation);
      window.removeEventListener('josum:set-dashboard-tab', handleDashboardTab);
    };
  }, []);

  useEffect(() => {
    const draft = readApplicationDraft();
    setApplicationDraft(draft);
    setApplicationDraftReady(true);
    if (!draft) return;

    const queryResidenceId = new URLSearchParams(window.location.search).get('residenceId');
    if (draft.residenceId && !queryResidenceId) setSelectedResidenceId(draft.residenceId);
    if (draft.gender) setApplicationGender(draft.gender);
    if (draft.applicantCategory) setApplicantCategory(draft.applicantCategory);
    if (draft.returningStudent) setReturningStudent(draft.returningStudent === 'true');
    if (draft.signatureDataUrl) setSignatureDataUrl(draft.signatureDataUrl);
  }, []);

  useEffect(() => {
    if (tab !== 'apply' || !applicationDraftReady || !applicationDraft || !applicationFormRef.current) return;
    restoreApplicationDraft(applicationFormRef.current, applicationDraft);
  }, [tab, applicationDraftReady, applicationDraft]);

  const activeApplication = applications.find((item) => !['REJECTED', 'CANCELLED', 'MOVED_OUT'].includes(item.status));
  const selectedDocumentApplication = applications.find((application) => application.id === documentApplicationId);
  const selectedDocumentTypes = requiredDocumentTypesForDocumentUpload(selectedDocumentApplication);
  const storageEligibleApplication = applications.find(
    (item) => item.status === 'APPROVED' && Boolean(item.acceptedAt) && Boolean(item.room),
  );
  const storageDefaultFullName = storageEligibleApplication
    ? `${storageEligibleApplication.applicantFirstName} ${storageEligibleApplication.applicantLastName}`.trim()
    : `${me?.firstName ?? ''} ${me?.lastName ?? ''}`.trim();
  const storageDefaultRoom = storageEligibleApplication?.room?.roomNumber?.toString() ?? storageEligibleApplication?.room?.name ?? '';
  const storageDefaultSite = storageSiteValue(storageEligibleApplication?.residence?.name);
  const visitorEligibleApplication = storageEligibleApplication;
  const availableRooms = residences.reduce((sum, residence) => sum + residence.availableRooms, 0);
  const selectedResidence = residences.find((residence) => residence.id === selectedResidenceId);
  const hasProfilePhoto = Boolean(me?.studentProfile?.hasProfileImage || me?.studentProfile?.profileImageUploadedAt);
  const availableResidenceRooms = residenceRooms.filter(
    (room) =>
      room.residenceId === selectedResidenceId &&
      room.status === 'AVAILABLE' &&
      (!applicationGender || room.genderAllocation === applicationGender),
  );
  const openMaintenance = maintenanceRequests.filter((item) => ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(item.status)).length;
  const storedItemsAwaitingCheckout = storageRequests.filter(
    (item) => item.status === 'ITEMS_RECEIVED' || item.status === 'RELEASE_REQUESTED',
  );
  const storageReleasePending = storageRequests.filter((item) => item.status === 'RELEASE_REQUESTED');
  const returningApplicationBlockedByStorage = returningStudent && storedItemsAwaitingCheckout.length > 0;

  function saveApplicationDraft() {
    if (!applicationFormRef.current) return;
    const draft = collectApplicationDraft(applicationFormRef.current);
    draft.residenceId = selectedResidenceId;
    draft.gender = applicationGender;
    draft.applicantCategory = applicantCategory;
    draft.returningStudent = String(returningStudent);
    draft.signatureDataUrl = signatureDataUrl;
    writeApplicationDraft(draft);
    setApplicationDraft(draft);
    toast.success('Application draft saved');
  }

  function clearApplicationDraft() {
    window.localStorage.removeItem(APPLICATION_DRAFT_STORAGE_KEY);
    setApplicationDraft(null);
    toast.success('Application draft cleared');
  }

  async function submitApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (applicationSubmitting) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    if (returningApplicationBlockedByStorage) {
      const request = storedItemsAwaitingCheckout[0];
      toast.error(`Request checkout of stored items before applying to return to your room. ${request.referenceCode} is ${formatEnum(request.status)}.`);
      setTab('storage');
      return;
    }
    if (!hasProfilePhoto) {
      toast.error('Upload your student profile photo before submitting an application');
      setTab('profile');
      return;
    }
    if (!signatureDataUrl) {
      toast.error('Draw and save your signature before submitting the application');
      return;
    }
    setApplicationSubmitting(true);
    try {
      await api('/applications', {
        method: 'POST',
        body: JSON.stringify(compactForm(form)),
      });
      toast.success('Application submitted');
      window.localStorage.removeItem(APPLICATION_DRAFT_STORAGE_KEY);
      setApplicationDraft(null);
      formElement.reset();
      setSelectedResidenceId('');
      setApplicationGender('');
      setApplicantCategory('NEW_STUDENT');
      setReturningStudent(false);
      setSignatureDataUrl('');
      await load();
      setTab('overview');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit application');
    } finally {
      setApplicationSubmitting(false);
    }
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const profile = await api<User>('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify(compactForm(form)),
      });
      setMe(profile);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update profile');
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await upload('/documents', form);
      toast.success('Document uploaded');
      formElement.reset();
      setDocumentApplicationId('');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    }
  }

  async function uploadProfilePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const profile = await upload<User>('/users/me/profile-photo', form);
      setMe(profile);
      toast.success('Profile photo uploaded');
      formElement.reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Profile photo upload failed');
    }
  }

  async function acceptApplication(id: string) {
    try {
      await api(`/applications/mine/${id}/accept`, { method: 'PATCH' });
      toast.success('Accommodation offer accepted');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not accept offer');
    }
  }

  async function submitMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/maintenance', {
        method: 'POST',
        body: JSON.stringify(compactForm(form)),
      });
      toast.success('Maintenance request submitted');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit maintenance request');
    }
  }

  async function submitVisitorPreRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!visitorEligibleApplication) {
      toast.error('Visitor pre-registration opens after you accept approval and have an assigned room');
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api('/security/visitor-pre-registrations', {
        method: 'POST',
        body: JSON.stringify(compactForm(form)),
      });
      toast.success('Visitor pre-registered');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not pre-register visitor');
    }
  }

  async function submitStorage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (storageSubmitting) return;
    if (!storageEligibleApplication) {
      toast.error('Storage requests open after you accept approval and have an assigned room');
      return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setStorageSubmitting(true);
    try {
      await upload('/storage-requests', form);
      toast.success('Storage request submitted');
      formElement.reset();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit storage request');
    } finally {
      setStorageSubmitting(false);
    }
  }

  async function requestStorageRelease(id: string) {
    if (storageReleaseSubmittingId) return;
    setStorageReleaseSubmittingId(id);
    try {
      await api(`/storage-requests/${id}/request-release`, { method: 'PATCH' });
      toast.success('Checkout request sent');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not request stored items');
    } finally {
      setStorageReleaseSubmittingId('');
    }
  }

  async function cancelApplication(id: string) {
    try {
      await api(`/applications/mine/${id}/cancel`, { method: 'PATCH' });
      toast.success('Application cancelled');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not cancel application');
    }
  }

  if (loading) {
    return (
      <AppShell mode="student">
        <div className="grid min-h-80 place-items-center text-sm text-slate-500">
          <RefreshCw className="mb-3 h-5 w-5 animate-spin text-brand" />
          Loading
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell mode="student">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink">Student portal</h1>
          <p className="mt-1 truncate text-sm text-slate-500">{me?.firstName} {me?.lastName}</p>
        </div>
        <div className="flex w-full overflow-x-auto rounded-lg border border-line bg-white p-1 sm:w-auto">
          {tabs.map(({ id, icon: Icon, title }) => (
            <button
              key={id}
              type="button"
              title={title}
              onClick={() => setTab(id)}
              className={`focus-ring flex h-9 w-10 shrink-0 items-center justify-center rounded-md ${
                tab === id ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
            <StatTile label="Available rooms" value={availableRooms} icon={Building2} />
            <StatTile label="Applications" value={applications.length} icon={Clock3} />
            <StatTile label="Active status" value={activeApplication?.status.replaceAll('_', ' ') ?? 'None'} icon={Home} />
            <StatTile label="Open maintenance" value={openMaintenance} icon={Wrench} />
            <StatTile label="Visitors" value={visitorPreRegistrations.length} icon={UserPlus} />
            <StatTile label="Storage requests" value={storageRequests.length} icon={Archive} />
            <StatTile label="Unread notices" value={notifications.filter((item) => !item.readAt).length} icon={FileUp} />
          </div>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Applications</h2>
            <div className="-mx-3 mt-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              {applications.length ? (
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-line text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-3">Reference</th>
                      <th>Room type</th>
                      <th>Residence</th>
                      <th>Status</th>
                      <th>Documents</th>
                      <th>Offer</th>
                      <th>Submitted</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {applications.map((application) => (
                      <tr key={application.id}>
                        <td className="py-3 font-medium">{application.referenceCode}</td>
                        <td>{application.roomType?.roomTypeName ?? 'Room type not linked'}</td>
                        <td>
                          <span className="font-medium text-ink">{application.residence?.name ?? 'Residence not linked'}</span>
                          <br />
                          <span className="text-xs text-slate-500">{application.residence?.address}</span>
                        </td>
                        <td><StatusBadge status={application.status} /></td>
                        <td>
                          <span className={application.documentsComplete ? 'text-emerald-700' : 'text-amber-700'}>
                            {application.documentsComplete ? 'Complete' : `${application.missingDocumentTypes?.length ?? 0} missing`}
                          </span>
                          <br />
                          <span className="text-xs text-slate-500">{application.documents?.length ?? 0} uploaded</span>
                        </td>
                        <td>
                          {application.status === 'APPROVED' ? (
                            application.acceptedAt ? (
                              <span className="text-emerald-700">Accepted</span>
                            ) : (
                              <span className="text-amber-700">
                                Expires {application.approvalExpiresAt ? new Date(application.approvalExpiresAt).toLocaleDateString() : 'soon'}
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td>{new Date(application.createdAt).toLocaleDateString()}</td>
                        <td className="text-right">
                          {application.status === 'APPROVED' && !application.acceptedAt && (
                            <button
                              type="button"
                              onClick={() => acceptApplication(application.id)}
                              className="focus-ring mb-2 rounded-lg border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-teal-50"
                            >
                              Accept
                            </button>
                          )}
                          {!['CANCELLED', 'REJECTED', 'MOVED_OUT'].includes(application.status) && (
                            <button
                              type="button"
                              onClick={() => cancelApplication(application.id)}
                              className="focus-ring rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState title="No applications" body="Create an application from the apply tab when a suitable room type is available." />
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Status history</h2>
            <div className="mt-4 grid gap-3">
              {applications.flatMap((application) =>
                (application.statusHistory ?? []).map((history) => (
                  <div key={history.id} className="rounded-lg border border-line p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{application.referenceCode}</span>
                      <StatusBadge status={history.toStatus} />
                      <span className="text-slate-500">{new Date(history.createdAt).toLocaleString()}</span>
                    </div>
                    {history.note && <p className="mt-2 text-slate-600">{history.note}</p>}
                  </div>
                )),
              )}
              {!applications.some((application) => (application.statusHistory?.length ?? 0) > 0) && (
                <p className="text-sm text-slate-500">No status updates yet.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'apply' && (
        <div className="grid gap-6">
          {!hasProfilePhoto && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
              Upload your student profile photo from the profile tab before submitting an accommodation application.
            </section>
          )}
          <ReturningStudentDisclaimer />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <section className="grid gap-4 self-start">
              <div className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
                <h2 className="font-semibold text-ink">Room availability</h2>
                <p className="mt-1 text-sm text-slate-500">Availability decreases only after an application is approved.</p>
              </div>
              {residences.length ? residences.map((residence) => (
                <div key={residence.id} className={`rounded-lg border bg-white p-3 shadow-sm sm:p-4 ${selectedResidenceId === residence.id ? 'border-brand ring-2 ring-brand/10' : 'border-line'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-ink">{residence.name}</h2>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {residence.address}
                      </p>
                    </div>
                    <span className="w-fit rounded-full border border-brand/20 bg-teal-50 px-3 py-1 text-sm font-semibold text-brand">
                      {residence.availableRooms} available
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <p><span className="text-slate-500">Residence type</span><br />{residence.residenceType}</p>
                    <p><span className="text-slate-500">Rooms</span><br />{residence.availableRooms} of {residence.totalRooms} available</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedResidenceId(residence.id)}
                    className="focus-ring mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-brand px-3 text-sm font-semibold text-brand hover:bg-teal-50"
                  >
                    {selectedResidenceId === residence.id ? 'Selected' : `Apply for ${residence.name}`}
                  </button>
                </div>
              )) : <EmptyState title="No residences" body="Residence availability will appear here when the API is available." />}
            </section>

            <form ref={applicationFormRef} onSubmit={submitApplication} className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
              <h2 className="font-semibold text-ink">Accommodation application</h2>
              <p className="mt-1 text-sm text-slate-500">Complete the booking details below after reviewing the reservation process and rates.</p>
              {applicationDraft && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
                  <span>Saved application draft restored on this device.</span>
                  <button
                    type="button"
                    onClick={clearApplicationDraft}
                    className="focus-ring inline-flex h-9 w-full items-center justify-center rounded-lg border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-700 hover:bg-blue-100 sm:w-auto"
                  >
                    Clear draft
                  </button>
                </div>
              )}
              {returningApplicationBlockedByStorage && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Returning-room applications are paused until your stored items are checked out.
                    {storageReleasePending.length ? ' Management still needs to release your requested items.' : ' Request your stored items from the storage tab first.'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setTab('storage')}
                    className="focus-ring inline-flex h-9 w-full items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 sm:w-auto"
                  >
                    Go to storage
                  </button>
                </div>
              )}
              {selectedResidence && (
                <div className="mt-4 rounded-lg border border-brand/20 bg-teal-50 p-3 text-sm">
                  <p className="font-semibold text-brand">Applying for {selectedResidence.name}</p>
                  <p className="mt-1 text-slate-600">{selectedResidence.address}</p>
                </div>
              )}
              <div className="mt-5 grid gap-6">
                <section className="grid gap-4">
                  <h3 className="text-sm font-semibold uppercase text-slate-500">Booking details</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-ink">
                      NWU Vaal Triangle student
                      <select name="isNwuStudent" required defaultValue="true" className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2">
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-ink">
                      Year of study
                      <select name="studyYear" required className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2">
                        <option value="">Select year</option>
                        <option value="FIRST YEAR">First year</option>
                        <option value="SECOND YEAR">Second year</option>
                        <option value="THIRD YEAR (FINAL YEAR)">Third year (final year)</option>
                        <option value="FOURTH YEAR (FINAL YEAR)">Fourth year (final year)</option>
                        <option value="EXTENDED">Extended</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-ink">
                      Study semester
                      <select name="studySemester" required className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2">
                        <option value="">Select semester</option>
                        <option value="FIRST AND SECOND SEMESTER">First and second semester</option>
                        <option value="FIRST SEMESTER ONLY">First semester only</option>
                        <option value="SECOND SEMESTER ONLY">Second semester only</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-ink">
                      Applicant category
                      <select
                        name="applicantCategory"
                        required
                        value={applicantCategory}
                        onChange={(event) => {
                          setApplicantCategory(event.target.value);
                          setReturningStudent(event.target.value === 'RETURNING_STUDENT');
                        }}
                        className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2"
                      >
                        <option value="NEW_STUDENT">New student</option>
                        <option value="RETURNING_STUDENT">Returning student</option>
                        <option value="TRANSFER_STUDENT">Transfer student</option>
                        <option value="INTERNATIONAL_STUDENT">International student</option>
                      </select>
                      <input name="returningStudent" type="hidden" value={String(returningStudent)} readOnly />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-ink">
                      Academic registration status
                      <select name="academicRegistrationStatus" required className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2">
                        <option value="">Select status</option>
                        <option value="REGISTERED">Registered</option>
                        <option value="PROVISIONALLY_ACCEPTED">Provisionally accepted</option>
                        <option value="NOT_REGISTERED_YET">Not registered yet</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-ink">
                      Residence
                      <select
                        name="residenceId"
                        required
                        value={selectedResidenceId}
                        onChange={(event) => setSelectedResidenceId(event.target.value)}
                        className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-ink"
                      >
                        <option value="">Select residence</option>
                        {residences.map((residence) => (
                          <option key={residence.id} value={residence.id} disabled={residence.availableRooms === 0}>
                            {residence.name} - {residence.availableRooms} rooms available
                          </option>
                        ))}
                      </select>
                    </label>
                    {returningStudent && (
                      <label className="grid gap-1 text-sm font-medium text-ink">
                        Preferred returning-student room
                        <select
                          name="roomId"
                          required
                          disabled={!selectedResidenceId}
                          className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2 disabled:bg-slate-100"
                        >
                          <option value="">{selectedResidenceId ? 'Select room' : 'Select residence first'}</option>
                          {availableResidenceRooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name} - {room.genderAllocation} - {room.roomTypeName}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs font-normal text-slate-500">
                          Josum 1 rooms 1-50 are allocated to female students and rooms 51-78 to male students.
                        </span>
                      </label>
                    )}
                    <label className="grid gap-1 text-sm font-medium text-ink">
                      Room category
                      <select
                        name="roomTypeId"
                        required
                        disabled={!roomTypes.length}
                        defaultValue={roomTypes[0]?.id ?? ''}
                        className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-ink disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        {!roomTypes.length && <option value="">No rooms available yet</option>}
                        {roomTypes.map((roomType) => (
                          <option key={roomType.id} value={roomType.id}>
                            {roomType.roomTypeName}
                          </option>
                        ))}
                      </select>
                      {!roomTypes.length && (
                        <span className="text-xs font-normal text-slate-500">
                          No numbered rooms are currently available.
                        </span>
                      )}
                    </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Date of occupation
                    <input name="dateOfOccupation" type="date" required className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Payment terms
                    <select name="paymentTerm" required className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2">
                      <option value="">Select payment term</option>
                      <option value="Once Off">Once Off</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="grid gap-4">
                <h3 className="text-sm font-semibold uppercase text-slate-500">Personal and institution details</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Student name
                    <input name="applicantFirstName" required defaultValue={me?.firstName ?? ''} className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Student surname
                    <input name="applicantLastName" required defaultValue={me?.lastName ?? ''} className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Student identity number
                    <input name="studentIdNumber" required defaultValue={String(me?.studentProfile?.idNumber ?? '')} className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Student number
                    <input name="studentNumber" required defaultValue={String(me?.studentProfile?.studentNumber ?? '')} className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Student phone number
                    <input name="studentPhone" type="tel" required defaultValue={me?.phone ?? ''} className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Nationality
                    <input name="nationality" required className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Gender
                    <select
                      name="gender"
                      required
                      value={applicationGender}
                      onChange={(event) => setApplicationGender(event.target.value)}
                      className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2"
                    >
                      <option value="">Select gender</option>
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Name of institution
                    <input name="institutionName" required defaultValue={String(me?.studentProfile?.institution ?? '')} className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Name of course
                    <input name="courseName" required defaultValue={String(me?.studentProfile?.course ?? '')} className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Postal code
                    <input name="postalCode" required className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink md:col-span-2">
                    Student advisor details
                    <textarea name="studentAdvisorDetails" rows={3} className="focus-ring w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                </div>
              </section>

              <section className="grid gap-4">
                <h3 className="text-sm font-semibold uppercase text-slate-500">Financial information</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Responsible funder
                    <select name="fundingType" required className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2">
                      <option value="">Select funder</option>
                      <option value="NSFAS">NSFAS</option>
                      <option value="Private Bursary">Private bursary</option>
                      <option value="Self Funding">Self funding</option>
                      <option value="Family Sponsor">Family sponsor</option>
                      <option value="Other">Other</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    NSFAS reference or private bursary name
                    <input name="fundingReference" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                </div>
              </section>

              <section className="grid gap-4">
                <h3 className="text-sm font-semibold uppercase text-slate-500">Parent or guardian</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Full names and surname
                    <input name="guarantorFullName" required className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    ID / Passport no
                    <input name="guarantorIdPassport" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Cell no
                    <input name="guarantorCell" required className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Email address
                    <input name="guarantorEmail" type="email" required className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Nationality
                    <input name="guarantorNationality" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Employer
                    <input name="guarantorEmployer" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink md:col-span-2">
                    Physical address
                    <textarea name="guarantorAddress" rows={3} className="focus-ring w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                </div>
              </section>

              <section className="grid gap-4">
                <h3 className="text-sm font-semibold uppercase text-slate-500">Next of kin</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Next of kin 1 name
                    <input name="nextOfKin1Name" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Relationship
                    <input name="nextOfKin1Relationship" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Cell no
                    <input name="nextOfKin1Cell" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Next of kin 2 name
                    <input name="nextOfKin2Name" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Relationship
                    <input name="nextOfKin2Relationship" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Cell no
                    <input name="nextOfKin2Cell" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Next of kin 3 name
                    <input name="nextOfKin3Name" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Relationship
                    <input name="nextOfKin3Relationship" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Cell no
                    <input name="nextOfKin3Cell" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
                  </label>
                </div>
              </section>

              <section className="grid gap-4">
                <h3 className="text-sm font-semibold uppercase text-slate-500">Additional notes</h3>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Do you have any medical conditions?
                  <select name="hasMedicalConditions" required defaultValue="false" className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  If yes, please specify
                  <textarea name="medicalDetails" rows={3} className="focus-ring w-full rounded-lg border border-line px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Any missing information?
                  <textarea name="additionalInformation" rows={3} className="focus-ring w-full rounded-lg border border-line px-3 py-2" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Special requirements
                  <textarea name="specialRequirements" rows={4} className="focus-ring w-full rounded-lg border border-line px-3 py-2" />
                </label>
                <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm text-slate-700">
                  <input name="termsAccepted" type="checkbox" required className="mt-1 h-4 w-4 rounded border-line text-brand" />
                  <span>I have read and agree to the Josum Student Accommodation application terms, reservation process, payment rules, cancellation penalties, and house rules.</span>
                </label>
              </section>

              <section className="grid gap-4 rounded-lg border border-line bg-slate-50 p-3 sm:p-4">
                <h3 className="text-sm font-semibold uppercase text-slate-500">Declaration and electronic signature</h3>
                <div className="grid gap-3 text-sm leading-6 text-slate-700">
                  <p>
                    I declare that I have read and agreed to all the terms in this Accommodation Application Form. By signing electronically, I understand and agree fully:
                  </p>
                  <ol className="grid list-decimal gap-2 pl-5">
                    <li>This application is subject to room availability on a first come first serve basis. Only available rooms will be offered to students.</li>
                    <li>Students may be moved to other rooms if the unit is not fully occupied for cost effectiveness, and any room price difference must be paid by the student.</li>
                    <li>The minimum term of the Student Accommodation Agreement is 10 months or a period ending November each year.</li>
                    <li>Cancellation may result in one month rental, application fee and administration fee being charged before signing, or 25% of the remainder of the contract during the year.</li>
                    <li>The deposit is refundable after the tenancy period if the room is returned in the same condition as occupation started.</li>
                  </ol>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    Electronic signature: full name
                    <input
                      name="electronicSignatureName"
                      required
                      placeholder="Type your full name"
                      className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-ink">
                    ID / Passport number
                    <input
                      name="electronicSignatureIdPassport"
                      required
                      placeholder="Type your ID or passport number"
                      className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2"
                    />
                  </label>
                </div>
                <input name="signatureDataUrl" type="hidden" value={signatureDataUrl} readOnly />
                <div className="grid gap-3 rounded-lg border border-line bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink">Drawn signature</p>
                      <p className="mt-1 text-xs text-slate-500">Open the signature pad, draw your signature, then save it before submitting.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSignatureModalOpen(true)}
                      className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                    >
                      <PenLine className="h-4 w-4" />
                      {signatureDataUrl ? 'Update signature' : 'Draw signature'}
                    </button>
                  </div>
                  {signatureDataUrl ? (
                    <div className="rounded-lg border border-line bg-slate-50 p-2">
                      <NextImage
                        src={signatureDataUrl}
                        alt="Saved electronic signature"
                        width={320}
                        height={96}
                        unoptimized
                        className="h-24 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-line bg-slate-50 p-3 text-sm text-slate-500">No drawn signature saved yet.</p>
                  )}
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-line bg-white p-3 text-sm text-slate-700">
                  <input name="declarationAccepted" type="checkbox" required className="mt-1 h-4 w-4 rounded border-line text-brand" />
                  <span>I confirm that the typed name and drawn signature above are my electronic signature and that the declaration is true and accepted.</span>
                </label>
              </section>

              <div className="grid gap-3 sm:flex sm:flex-wrap">
                <button
                  type="button"
                  onClick={saveApplicationDraft}
                  className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  Save draft
                </button>
                <button
                  disabled={applicationSubmitting}
                  className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                >
                  <Send className="h-4 w-4" />
                  {applicationSubmitting ? 'Submitting' : 'Submit'}
                </button>
              </div>
            </div>
          </form>
          </div>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <form onSubmit={submitMaintenance} className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Report maintenance</h2>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-ink">
                Issue title
                <input name="title" required className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Category
                  <select name="category" required defaultValue="OTHER" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2">
                    {maintenanceCategories.map((category) => (
                      <option key={category} value={category}>{formatEnum(category)}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Priority
                  <select name="priority" defaultValue="MEDIUM" className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2">
                    {maintenancePriorities.map((priority) => (
                      <option key={priority} value={priority}>{formatEnum(priority)}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Room type
                <select name="roomTypeId" className="focus-ring h-11 w-full rounded-lg border border-line bg-white px-3 py-2 text-ink">
                  <option value="">Not room-type-specific</option>
                  {roomTypes.map((roomType) => (
                    <option key={roomType.id} value={roomType.id}>{roomType.roomTypeName}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Location
                <input name="location" placeholder="Room, block, hallway, kitchen..." className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Description
                <textarea name="description" required rows={5} className="focus-ring w-full rounded-lg border border-line px-3 py-2" />
              </label>
              <button className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white sm:w-auto">
                <Wrench className="h-4 w-4" />
                Submit complaint
              </button>
            </div>
          </form>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">My maintenance requests</h2>
            <div className="mt-4 grid gap-3">
              {maintenanceRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{request.title}</p>
                      <p className="mt-1 text-slate-500">
                        {request.referenceCode} - {formatEnum(request.category)} - {request.roomType?.roomTypeName ?? 'No room type'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <MaintenancePriorityBadge priority={request.priority} />
                      <MaintenanceStatusBadge status={request.status} />
                    </div>
                  </div>
                  <p className="mt-3 text-slate-600">{request.description}</p>
                  {request.location && <p className="mt-2 text-slate-500">Location: {request.location}</p>}
                  <div className="mt-3">
                    <MaintenanceSlaPanel request={request} />
                  </div>
                  {request.resolutionNote && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-semibold uppercase text-emerald-700">Resolution note</p>
                      <p className="mt-1 text-emerald-950">{request.resolutionNote}</p>
                    </div>
                  )}
                </div>
              ))}
              {!maintenanceRequests.length && (
                <EmptyState title="No maintenance requests" body="Report a residence issue here and the administration team will respond." />
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'visitors' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <form onSubmit={submitVisitorPreRegistration} className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Visitor pre-registration</h2>
            <p className="mt-1 text-sm text-slate-500">Your name, student number, accommodation and room are linked from your active resident profile.</p>
            {!visitorEligibleApplication && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Visitor pre-registration becomes available after your approval is accepted and a room has been assigned.
              </div>
            )}
            {visitorEligibleApplication && (
              <div className="mt-4 rounded-lg border border-brand/20 bg-teal-50 p-3 text-sm">
                <p className="font-semibold text-brand">{visitorEligibleApplication.residence?.name}</p>
                <p className="mt-1 text-slate-600">{visitorEligibleApplication.room?.name} - {visitorEligibleApplication.studentNumber}</p>
              </div>
            )}
            <div className="mt-5 grid gap-4">
              <label className="grid gap-1 text-sm font-medium text-ink">
                Visitor full name
                <input name="visitorName" required maxLength={120} disabled={!visitorEligibleApplication} className="focus-ring h-11 rounded-lg border border-line px-3 disabled:bg-slate-100" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Visitor contact
                  <input name="visitorPhone" disabled={!visitorEligibleApplication} className="focus-ring h-11 rounded-lg border border-line px-3 disabled:bg-slate-100" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Visitor ID / passport
                  <input name="visitorIdNumber" maxLength={80} disabled={!visitorEligibleApplication} className="focus-ring h-11 rounded-lg border border-line px-3 disabled:bg-slate-100" />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Relationship
                <input name="relationship" required maxLength={80} disabled={!visitorEligibleApplication} className="focus-ring h-11 rounded-lg border border-line px-3 disabled:bg-slate-100" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Expected visit date
                  <input name="expectedVisitDate" type="date" required disabled={!visitorEligibleApplication} className="focus-ring h-11 rounded-lg border border-line px-3 disabled:bg-slate-100" />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Expected arrival time
                  <input name="expectedArrivalTime" type="time" required disabled={!visitorEligibleApplication} className="focus-ring h-11 rounded-lg border border-line px-3 disabled:bg-slate-100" />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Vehicle registration
                <input name="vehicleRegistration" maxLength={40} disabled={!visitorEligibleApplication} className="focus-ring h-11 rounded-lg border border-line px-3 disabled:bg-slate-100" />
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Notes
                <textarea name="notes" rows={3} maxLength={1000} disabled={!visitorEligibleApplication} className="focus-ring rounded-lg border border-line px-3 py-2 disabled:bg-slate-100" />
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm text-slate-700">
                <input name="termsAccepted" type="checkbox" required disabled={!visitorEligibleApplication} className="mt-1 h-4 w-4 rounded border-line text-brand" />
                <span>I confirm this visitor must follow residence visitor rules and security check-in requirements.</span>
              </label>
              <button disabled={!visitorEligibleApplication} className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">
                <UserPlus className="h-4 w-4" />
                Pre-register visitor
              </button>
            </div>
          </form>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">My visitor pre-registrations</h2>
            <div className="mt-4 grid gap-3">
              {visitorPreRegistrations.map((visitor) => (
                <div key={visitor.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-ink">{visitor.visitorName}</p>
                      <p className="mt-1 text-slate-500">{visitor.relationship} - {new Date(visitor.expectedVisitDate).toLocaleDateString()} at {visitor.expectedArrivalTime}</p>
                      <p className="mt-1 text-slate-500">{visitor.residence?.name ?? 'Residence linked by profile'} - {visitor.room?.name ?? 'Room linked by profile'}</p>
                    </div>
                    <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold">{formatEnum(visitor.status)}</span>
                  </div>
                  {visitor.visitorLog && (
                    <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                      Checked in {new Date(visitor.visitorLog.checkedInAt).toLocaleString()}
                      {visitor.visitorLog.checkedOutAt ? `, checked out ${new Date(visitor.visitorLog.checkedOutAt).toLocaleString()}` : ''}
                    </p>
                  )}
                </div>
              ))}
              {!visitorPreRegistrations.length && <EmptyState title="No visitors" body="Expected visitor pre-registrations will appear here." />}
            </div>
          </section>
        </div>
      )}

      {tab === 'storage' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
          <form key={storageEligibleApplication?.id ?? 'no-storage'} onSubmit={submitStorage} className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-ink">New storage request</h2>
                <p className="mt-1 text-sm text-slate-500">For recess departure: upload the completed storage form and clear item photos.</p>
              </div>
              <button
                type="button"
                onClick={() => downloadStorageFormTemplate().catch((error) => toast.error(error.message))}
                className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Form
              </button>
            </div>

            {!storageEligibleApplication && (
              <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                Storage requests become available after your approval is accepted and a room has been assigned.
              </div>
            )}

            {storageEligibleApplication && (
              <div className="mt-4 rounded-lg border border-brand/20 bg-teal-50 p-3 text-sm">
                <p className="font-semibold text-brand">{storageEligibleApplication.residence?.name}</p>
                <p className="mt-1 text-slate-600">
                  {storageEligibleApplication.room?.name ?? 'Assigned room'} - {storageEligibleApplication.studentNumber}
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Student name and surname
                  <input
                    name="studentFullName"
                    defaultValue={storageDefaultFullName}
                    readOnly
                    disabled={!storageEligibleApplication || storageSubmitting}
                    className="focus-ring h-10 rounded-lg border border-line bg-slate-50 px-3 text-sm disabled:bg-slate-100"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Student number
                  <input
                    name="studentNumber"
                    defaultValue={storageEligibleApplication?.studentNumber ?? me?.studentProfile?.studentNumber ?? ''}
                    readOnly
                    disabled={!storageEligibleApplication || storageSubmitting}
                    className="focus-ring h-10 rounded-lg border border-line bg-slate-50 px-3 text-sm disabled:bg-slate-100"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Student room number
                  <input
                    name="studentRoomNumber"
                    defaultValue={storageDefaultRoom}
                    readOnly
                    disabled={!storageEligibleApplication || storageSubmitting}
                    className="focus-ring h-10 rounded-lg border border-line bg-slate-50 px-3 text-sm disabled:bg-slate-100"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Storage site
                  <select
                    name="storageSite"
                    required
                    defaultValue={storageDefaultSite}
                    disabled={!storageEligibleApplication || storageSubmitting}
                    className="focus-ring h-10 rounded-lg border border-line bg-white px-3 text-sm disabled:bg-slate-100"
                  >
                    <option value="">Select</option>
                    {storageSiteOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Number of items stored
                  <input
                    name="numberOfItemsStored"
                    type="number"
                    min={1}
                    max={200}
                    required
                    disabled={!storageEligibleApplication || storageSubmitting}
                    className="focus-ring h-10 rounded-lg border border-line px-3 text-sm disabled:bg-slate-100"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-ink">
                  Student signature
                  <input
                    name="studentSignature"
                    defaultValue={storageDefaultFullName}
                    maxLength={160}
                    required
                    disabled={!storageEligibleApplication || storageSubmitting}
                    className="focus-ring h-10 rounded-lg border border-line px-3 text-sm disabled:bg-slate-100"
                  />
                </label>
              </div>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Item description of items
                <textarea
                  name="itemDescription"
                  rows={6}
                  required
                  disabled={!storageEligibleApplication || storageSubmitting}
                  className="focus-ring w-full rounded-lg border border-line px-3 py-2 disabled:bg-slate-100"
                />
              </label>
              <label className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <input
                  name="storageNoticeAccepted"
                  type="checkbox"
                  value="true"
                  required
                  disabled={!storageEligibleApplication || storageSubmitting}
                  className="mt-1 h-4 w-4 rounded border-amber-300 text-brand"
                />
                <span>
                  Storage services are only offered to students residing at Josum for the academic year. Retrieving belongings before moving out may carry a monthly fee of R 4 100 for the storage period.
                </span>
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Item photographs
                <input
                  name="itemImages"
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  required
                  disabled={!storageEligibleApplication || storageSubmitting}
                  className="focus-ring w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
                <span className="text-xs font-normal text-slate-500">Upload at least one clear JPG or PNG photograph.</span>
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Signed storage form
                <input
                  name="storageForm"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={!storageEligibleApplication || storageSubmitting}
                  className="focus-ring w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm disabled:bg-slate-100"
                />
                <span className="text-xs font-normal text-slate-500">Optional PDF, JPG or PNG if a paper form was signed.</span>
              </label>
              <button
                disabled={!storageEligibleApplication || storageSubmitting}
                className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                <Archive className="h-4 w-4" />
                {storageSubmitting ? 'Submitting' : 'Submit new storage request'}
              </button>
            </div>
          </form>

          <div className="grid gap-6">
          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold text-ink">Request stored items</h2>
                <p className="mt-1 text-sm text-slate-500">For returning from recess: request checkout of items already received into storage.</p>
              </div>
              <Clock3 className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <div className="mt-4 grid gap-3">
              {storedItemsAwaitingCheckout.map((request) => (
                <div key={request.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-ink">{request.referenceCode}</p>
                      <p className="mt-1 text-slate-500">
                        {request.residence?.name ?? 'Residence not linked'} - {request.room?.name ?? 'Room not linked'}
                      </p>
                    </div>
                    <StorageStatusBadge status={request.status} />
                  </div>
                  <div className="mt-3 grid gap-2 rounded-lg border border-line bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                    <span>Storage site: {request.storageSite ? formatEnum(request.storageSite) : request.residence?.name ?? 'Not captured'}</span>
                    <span>Items stored: {request.numberOfItemsStored ?? 'Not captured'}</span>
                    <span>Received: {request.receivedAt ? new Date(request.receivedAt).toLocaleString() : 'Not captured'}</span>
                    <span>Room number: {request.studentRoomNumber ?? request.room?.roomNumber ?? request.room?.name ?? 'Not captured'}</span>
                  </div>
                  {request.status === 'ITEMS_RECEIVED' ? (
                    <button
                      type="button"
                      onClick={() => requestStorageRelease(request.id)}
                      disabled={storageReleaseSubmittingId === request.id}
                      className="focus-ring mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
                    >
                      <Download className="h-4 w-4" />
                      {storageReleaseSubmittingId === request.id ? 'Requesting' : 'Request my items'}
                    </button>
                  ) : (
                    <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-900">
                      Checkout requested. Management must mark the items released before a returning-room application can be submitted.
                    </p>
                  )}
                </div>
              ))}
              {!storedItemsAwaitingCheckout.length && (
                <EmptyState title="No stored items awaiting checkout" body="If you do not have items in storage, you can continue with your room application." />
              )}
            </div>
          </section>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">My storage requests</h2>
            <div className="mt-4 grid gap-3">
              {storageRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-line p-3 text-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-ink">{request.referenceCode}</p>
                      <p className="mt-1 text-slate-500">
                        {request.residence?.name ?? 'Residence not linked'} - {request.room?.name ?? 'Room not linked'}
                      </p>
                    </div>
                    <StorageStatusBadge status={request.status} />
                  </div>
                  <div className="mt-3 grid gap-2 rounded-lg border border-line bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2">
                    <span>Student: {request.studentFullName ?? (`${request.user?.firstName ?? ''} ${request.user?.lastName ?? ''}`.trim() || 'Not captured')}</span>
                    <span>Student number: {request.studentNumber ?? request.application?.studentNumber ?? request.user?.studentProfile?.studentNumber ?? 'Not captured'}</span>
                    <span>Room number: {request.studentRoomNumber ?? request.room?.roomNumber ?? request.room?.name ?? 'Not captured'}</span>
                    <span>Storage site: {request.storageSite ? formatEnum(request.storageSite) : request.residence?.name ?? 'Not captured'}</span>
                    <span>Items stored: {request.numberOfItemsStored ?? 'Not captured'}</span>
                    <span>Student signature: {request.studentSignature ?? 'Not captured'}</span>
                  </div>
                  {request.itemDescription && <p className="mt-3 whitespace-pre-line text-slate-600">{request.itemDescription}</p>}
                  {request.reviewNotes && (
                    <div className="mt-3 rounded-lg border border-line bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase text-slate-500">Review notes</p>
                      <p className="mt-1 whitespace-pre-line text-slate-700">{request.reviewNotes}</p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {request.files.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => downloadStorageFile(file.id, file.originalName).catch((error) => toast.error(error.message))}
                        className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {file.fileType === 'FORM' ? 'Form' : 'Photo'}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="text-xs font-semibold uppercase text-slate-500">History</p>
                    <div className="mt-2 grid gap-2">
                      {request.statusHistory.map((history) => (
                        <div key={history.id} className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <StorageStatusBadge status={history.toStatus} />
                          <span>{new Date(history.createdAt).toLocaleString()}</span>
                          {history.note && <span className="text-slate-500">{history.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {!storageRequests.length && (
                <EmptyState title="No storage requests" body="Storage submissions and review history will appear here." />
              )}
            </div>
          </section>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <form onSubmit={uploadDocument} className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Upload document</h2>
            <div className="mt-4 grid gap-4">
              <div className="rounded-lg border border-line bg-slate-50 p-3">
                <p className="text-sm font-semibold text-ink">Required documents</p>
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm leading-6 text-slate-600">
                  {selectedDocumentTypes.map((type) => (
                    <li key={type}>{documentTypeLabel(type)}</li>
                  ))}
                </ul>
                {!selectedDocumentApplication && (
                  <p className="mt-2 text-xs text-slate-500">Select an application below to see the required documents for that student type.</p>
                )}
                {selectedDocumentApplication && !selectedDocumentTypes.length && (
                  <p className="mt-2 text-xs text-slate-500">Required documents will appear after this application finishes loading.</p>
                )}
              </div>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Application
                <select
                  name="applicationId"
                  required
                  value={documentApplicationId}
                  onChange={(event) => setDocumentApplicationId(event.target.value)}
                  className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2"
                >
                  <option value="">Select</option>
                  {applications.map((application) => (
                    <option key={application.id} value={application.id}>{application.referenceCode}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-sm font-medium text-ink">
                Type
                <select
                  name="type"
                  required
                  disabled={!selectedDocumentTypes.length}
                  className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2 disabled:bg-slate-100"
                >
                  <option value="">{selectedDocumentApplication ? 'Select required document' : 'Select an application first'}</option>
                  {selectedDocumentTypes.map((type) => (
                    <option key={type} value={type}>{documentTypeLabel(type)}</option>
                  ))}
                </select>
              </label>
              <input name="file" type="file" required className="focus-ring w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm" />
              <button className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white sm:w-auto">
                <FileUp className="h-4 w-4" />
                Upload
              </button>
            </div>
          </form>

          <section className="rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
            <h2 className="font-semibold text-ink">Submitted documents</h2>
            <div className="mt-4 grid gap-3">
              {applications.flatMap((application) =>
                (application.documents ?? []).map((document) => (
                  <div key={document.id} className="flex flex-col gap-3 rounded-lg border border-line p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-ink">{document.originalName}</p>
                      <p className="text-slate-500">{application.referenceCode} - {documentTypeLabel(document.type)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadDocument(document.id, document.originalName).catch((error) => toast.error(error.message))}
                      className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 font-semibold text-slate-600 hover:bg-slate-50 sm:w-auto"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                )),
              )}
              {!applications.some((application) => (application.documents?.length ?? 0) > 0) && (
                <p className="text-sm text-slate-500">No documents uploaded.</p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === 'profile' && me && (
        <ProfileForm user={me} onSubmit={updateProfile} onPhotoSubmit={uploadProfilePhoto} />
      )}

      {signatureModalOpen && (
        <SignatureModal
          initialValue={signatureDataUrl}
          onClose={() => setSignatureModalOpen(false)}
          onSave={(value) => {
            setSignatureDataUrl(value);
            setSignatureModalOpen(false);
            toast.success('Signature saved');
          }}
        />
      )}
    </AppShell>
  );
}

function ReturningStudentDisclaimer() {
  return (
    <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase text-amber-800">Disclaimer</p>
          <h2 className="mt-1 text-base font-bold uppercase text-ink">For returning students only</h2>
          <p className="mt-2 max-w-4xl text-sm font-medium leading-6 text-slate-800">
            Please choose a room below. After choosing, come and sign a storage form for that room.
            Failure to do so will result in you forfeiting rights of ownership to that particular room.
          </p>
        </div>
      </div>
    </section>
  );
}

function SignatureModal({
  initialValue,
  onClose,
  onSave,
}: {
  initialValue?: string;
  onClose(): void;
  onSave(value: string): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(Boolean(initialValue));

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#0f172a';

    if (initialValue) {
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
      };
      image.src = initialValue;
    }
  }, [initialValue]);

  function pointerPosition(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect) return { x: 0, y: 0 };
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function startDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    event.preventDefault();
    drawingRef.current = true;
    const point = pointerPosition(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
    setHasInk(true);
  }

  function draw(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    event.preventDefault();
    const point = pointerPosition(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing(event: ReactPointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#0f172a';
    setHasInk(false);
  }

  function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    onSave(canvas.toDataURL('image/png'));
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 sm:p-6">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-line p-4">
          <div>
            <h2 className="font-semibold text-ink">Draw your signature</h2>
            <p className="mt-1 text-sm text-slate-500">Use your mouse, trackpad, or finger inside the signature box.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring grid h-10 w-10 place-items-center rounded-lg border border-line text-slate-600 hover:bg-slate-50"
            aria-label="Close signature modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-4 p-4">
          <canvas
            ref={canvasRef}
            width={720}
            height={260}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            className="h-64 w-full rounded-lg border border-line bg-white shadow-inner"
            style={{ touchAction: 'none' }}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={clearSignature}
              className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
            <button
              type="button"
              onClick={saveSignature}
              disabled={!hasInk}
              className="focus-ring inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white disabled:opacity-50 sm:w-auto"
            >
              <Check className="h-4 w-4" />
              Save signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileForm({
  user,
  onSubmit,
  onPhotoSubmit,
}: {
  user: User;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  onPhotoSubmit(event: FormEvent<HTMLFormElement>): void;
}) {
  const profile = useMemo(() => user.studentProfile ?? {}, [user.studentProfile]) as NonNullable<User['studentProfile']>;
  const hasPhoto = Boolean(profile.hasProfileImage || profile.profileImageUploadedAt);
  return (
    <div className="grid gap-6">
      <form onSubmit={onPhotoSubmit} className="grid gap-4 rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">Student profile photo</h2>
            <p className="mt-1 text-sm text-slate-500">
              {hasPhoto ? `Uploaded ${profile.profileImageUploadedAt ? new Date(profile.profileImageUploadedAt).toLocaleDateString() : ''}` : 'Required before submitting an application.'}
            </p>
          </div>
          <span className={`w-fit rounded-full border px-3 py-1 text-sm font-semibold ${hasPhoto ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            {hasPhoto ? 'Ready' : 'Required'}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-sm font-medium text-ink">
            JPEG or PNG photo
            <input name="file" type="file" accept="image/jpeg,image/png" required className="focus-ring w-full rounded-lg border border-line bg-white px-3 py-2 text-sm" />
          </label>
          <button className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white sm:w-auto">
            <FileUp className="h-4 w-4" />
            Upload photo
          </button>
        </div>
      </form>

      <form onSubmit={onSubmit} className="grid gap-5 rounded-lg border border-line bg-white p-3 shadow-sm sm:p-4">
        <h2 className="font-semibold text-ink">Profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['firstName', 'First name', user.firstName],
            ['lastName', 'Last name', user.lastName],
            ['phone', 'Phone', user.phone ?? ''],
            ['studentNumber', 'Student number', profile.studentNumber ?? ''],
            ['institution', 'Institution', profile.institution ?? ''],
            ['course', 'Course', profile.course ?? ''],
            ['yearOfStudy', 'Year of study', profile.yearOfStudy ?? ''],
            ['idNumber', 'ID number', profile.idNumber ?? ''],
            ['emergencyName', 'Emergency contact', profile.emergencyName ?? ''],
            ['emergencyPhone', 'Emergency phone', profile.emergencyPhone ?? ''],
          ].map(([name, label, value]) => (
            <label key={name as string} className="grid gap-1 text-sm font-medium text-ink">
              {label}
              <input
                name={name as string}
                defaultValue={String(value ?? '')}
                pattern={name === 'idNumber' ? '\\d{13}' : undefined}
                inputMode={name === 'idNumber' ? 'numeric' : undefined}
                minLength={name === 'idNumber' ? 13 : undefined}
                maxLength={name === 'idNumber' ? 13 : undefined}
                title={name === 'idNumber' ? 'Enter a valid South African ID number with 13 digits' : undefined}
                className="focus-ring h-11 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
          ))}
        </div>
        <label className="grid gap-1 text-sm font-medium text-ink">
          Address
          <textarea name="address" rows={3} defaultValue={String(profile.address ?? '')} className="focus-ring w-full rounded-lg border border-line px-3 py-2" />
        </label>
        <button className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white sm:w-fit">
          <UserRound className="h-4 w-4" />
          Save profile
        </button>
      </form>
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

function StorageStatusBadge({ status }: { status: StorageRequest['status'] }) {
  const classes: Record<StorageRequest['status'], string> = {
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

function MaintenancePriorityBadge({ priority }: { priority: MaintenancePriority }) {
  const classes: Record<MaintenancePriority, string> = {
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

function formatEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function storageSiteValue(name?: string | null) {
  const normalized = name?.toLowerCase() ?? '';
  if (normalized.includes('two') || normalized.includes('2')) return 'JOSUM_TWO';
  if (normalized.includes('one') || normalized.includes('1')) return 'JOSUM_ONE';
  return '';
}

function collectApplicationDraft(form: HTMLFormElement): ApplicationDraft {
  const draft: ApplicationDraft = {};
  Array.from(form.elements).forEach((element) => {
    const field = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
    if (!field.name || field instanceof HTMLButtonElement) return;
    if (field instanceof HTMLInputElement && field.type === 'file') return;
    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      draft[field.name] = String(field.checked);
      return;
    }
    draft[field.name] = field.value;
  });
  return draft;
}

function readApplicationDraft(): ApplicationDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(APPLICATION_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, typeof value === 'string' ? value : String(value)]),
    );
  } catch {
    return null;
  }
}

function writeApplicationDraft(draft: ApplicationDraft) {
  window.localStorage.setItem(APPLICATION_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

function restoreApplicationDraft(form: HTMLFormElement, draft: ApplicationDraft) {
  Object.entries(draft).forEach(([name, value]) => {
    const field = form.elements.namedItem(name);
    if (!field || field instanceof RadioNodeList) return;
    if (field instanceof HTMLInputElement && field.type === 'checkbox') {
      field.checked = value === 'true';
      return;
    }
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement) {
      field.value = value;
    }
  });
}

function documentTypeLabel(type: DocumentTypeValue) {
  return documentTypeLabels[type] ?? formatEnum(type);
}

function requiredDocumentTypesForDocumentUpload(application?: Application): DocumentTypeValue[] {
  if (!application) return [];
  if (application.requiredDocumentTypes?.length) return application.requiredDocumentTypes;

  const shared: DocumentTypeValue[] = ['STUDENT_ID_COPY', 'PROOF_OF_FUNDING', 'PARENT_ID_COPY'];
  const studyYear = application.studyYear?.trim().toUpperCase();
  const firstYear =
    studyYear === 'FIRST YEAR' ||
    (!studyYear && application.applicantCategory === 'NEW_STUDENT' && !application.returningStudent);

  return firstYear
    ? [...shared, 'ACCEPTANCE_LETTER', 'PROOF_OF_REGISTRATION']
    : [...shared, 'ACADEMIC_RECORD'];
}

function isStudentTab(value: string | null | undefined): value is Tab {
  return tabs.some((item) => item.id === value);
}
