'use client';

const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL;
const SESSION_STORAGE_KEY = 'josum.session';
const LEGACY_SESSION_STORAGE_KEYS = ['louiseville.session', 'nathi.session'];
const SESSION_MAX_IDLE_MS = 30 * 60 * 1000;

function getApiUrl() {
  const configured = CONFIGURED_API_URL?.trim().replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    if (configured) {
      const url = new URL(configured);
      const pageHost = window.location.hostname;
      const configuredIsLoopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
      const pageIsLoopback = ['localhost', '127.0.0.1', '::1'].includes(pageHost);
      if (configuredIsLoopback && !pageIsLoopback) {
        url.hostname = pageHost;
        return url.toString().replace(/\/$/, '');
      }
      return configured;
    }
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }
  if (configured) return configured;
  return 'http://localhost:4000';
}

function apiEndpoint(path: string) {
  return `${getApiUrl()}${path}`;
}

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  lastActivityAt?: number;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
};

export function saveSession(session: AuthSession) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...session, lastActivityAt: Date.now() }));
  LEGACY_SESSION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw =
    localStorage.getItem(SESSION_STORAGE_KEY) ??
    LEGACY_SESSION_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    const lastActivityAt = session.lastActivityAt ?? 0;
    if (lastActivityAt && Date.now() - lastActivityAt > SESSION_MAX_IDLE_MS) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    clearSession();
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  LEGACY_SESSION_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function touchSession() {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return;
  try {
    const session = JSON.parse(raw) as AuthSession;
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ ...session, lastActivityAt: Date.now() }));
  } catch {
    clearSession();
  }
}

async function refreshSession() {
  const session = getSession();
  if (!session?.refreshToken) return null;
  let response: Response;
  try {
    response = await fetch(apiEndpoint('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
  } catch {
    throw new Error(`Could not reach the API at ${getApiUrl()}. Check that the backend is running and this web origin is allowed.`);
  }
  if (!response.ok) {
    clearSession();
    return null;
  }
  const next = (await response.json()) as AuthSession;
  saveSession(next);
  return next;
}

export async function api<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const session = getSession();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`);

  let response: Response;
  try {
    response = await fetch(apiEndpoint(path), {
      ...options,
      headers,
    });
  } catch {
    throw new Error(`Could not reach the API at ${getApiUrl()}. Check that the backend is running and this web origin is allowed.`);
  }

  if (response.status === 401 && retry) {
    const next = await refreshSession();
    if (next) return api<T>(path, options, false);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    throw new Error(message ?? `Request failed with ${response.status}`);
  }

  touchSession();
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function upload<T>(path: string, formData: FormData): Promise<T> {
  return api<T>(path, { method: 'POST', body: formData });
}

export async function downloadDocument(id: string, filename: string) {
  return downloadAuthorized(`/documents/${id}/download`, filename, 'Could not download document');
}

export async function downloadStorageFile(id: string, filename: string) {
  return downloadAuthorized(`/storage-requests/files/${id}/download`, filename, 'Could not download storage file');
}

export async function downloadStorageFormTemplate() {
  return downloadAuthorized('/storage-requests/form-template', 'josum-student-storage-form.txt', 'Could not download storage form');
}

export async function downloadStorageExport(query = '') {
  const suffix = query ? `?${query}` : '';
  return downloadAuthorized(
    `/storage-requests/admin/export${suffix}`,
    `josum-storage-requests-${new Date().toISOString().slice(0, 10)}.csv`,
    'Could not export storage requests',
  );
}

export async function downloadFinanceExport(query = '') {
  const suffix = query ? `?${query}` : '';
  return downloadAuthorized(
    `/reports/finance/export${suffix}`,
    `josum-finance-report-${new Date().toISOString().slice(0, 10)}.csv`,
    'Could not export finance report',
  );
}

export async function downloadInspectionExport(query = '') {
  const suffix = query ? `?${query}` : '';
  return downloadAuthorized(
    `/inspections/export${suffix}`,
    `josum-inspections-${new Date().toISOString().slice(0, 10)}.csv`,
    'Could not export inspections',
  );
}

export async function downloadInspectionAttachment(id: string, filename: string) {
  return downloadAuthorized(`/inspections/attachments/${id}/download`, filename, 'Could not download inspection attachment');
}

async function downloadAuthorized(path: string, filename: string, fallbackMessage: string) {
  const session = getSession();
  let response: Response;
  try {
    response = await fetch(apiEndpoint(path), {
      headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : undefined,
    });
  } catch {
    throw new Error(`Could not reach the API at ${getApiUrl()}. Check that the backend is running and this web origin is allowed.`);
  }

  if (response.status === 401) {
    const next = await refreshSession();
    if (next) {
      response = await fetch(apiEndpoint(path), {
        headers: { Authorization: `Bearer ${next.accessToken}` },
      });
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message;
    throw new Error(message ?? fallbackMessage);
  }
  touchSession();
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function compactForm(form: FormData) {
  const numericFields = new Set([
    'monthlyRate',
    'depositAmount',
    'totalRooms',
    'availableRooms',
    'yearOfStudy',
    'year',
    'page',
    'limit',
  ]);
  const booleanFields = new Set([
    'termsAccepted',
    'declarationAccepted',
    'isNwuStudent',
    'returningStudent',
    'hasMedicalConditions',
    'maintenanceRequired',
    'studentAcknowledgement',
    'inspectorConfirmed',
    'studentConfirmed',
    'followUpRequired',
    'certifiedIdCopy',
    'proofOfRegistration',
    'academicRecord',
    'proofOfFunding',
    'signedLeaseAgreement',
    'studentDeclaration',
  ]);

  return Object.fromEntries(
    [...form.entries()]
      .filter(([, value]) => value !== '')
      .map(([key, value]) => {
        if (value instanceof File) return [key, value];
        if (booleanFields.has(key)) return [key, value === 'on' || value === 'true'];
        if (numericFields.has(key) && typeof value === 'string') {
          const parsed = Number(value);
          if (!Number.isNaN(parsed)) return [key, parsed];
        }
        return [key, value];
      }),
  );
}
