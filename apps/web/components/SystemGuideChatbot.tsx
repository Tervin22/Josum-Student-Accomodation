'use client';

import clsx from 'clsx';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  ClipboardList,
  FileUp,
  GraduationCap,
  History,
  Home,
  KeyRound,
  LayoutDashboard,
  LogIn,
  Mail,
  Send,
  Settings,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { getSession } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';

type DashboardMode = 'student' | 'admin' | 'manager' | 'security' | 'technician';
type GuideMode = DashboardMode | 'public';
type StaffGuideMode = Exclude<GuideMode, 'public' | 'student'>;
type GuideAction = {
  label: string;
  icon: LucideIcon;
  href?: string;
  mode?: DashboardMode;
  tab?: string;
  prompt?: string;
};
type GuideMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  actions?: GuideAction[];
};
type DashboardTabEventDetail = {
  mode?: DashboardMode;
  tab?: string;
};
type LoginPortalEventDetail = {
  portal?: 'student' | 'admin';
  bootstrap?: boolean;
};

const studentNavigationActions: GuideAction[] = [
  { label: 'Open overview', icon: Home, href: '/student/dashboard', mode: 'student', tab: 'overview' },
  { label: 'Start application', icon: ClipboardList, href: '/student/dashboard', mode: 'student', tab: 'apply' },
  { label: 'Upload documents', icon: FileUp, href: '/student/dashboard', mode: 'student', tab: 'documents' },
  { label: 'Report maintenance', icon: Wrench, href: '/student/dashboard', mode: 'student', tab: 'maintenance' },
  { label: 'Update profile', icon: UserRound, href: '/student/dashboard', mode: 'student', tab: 'profile' },
];

const adminNavigationActions: GuideAction[] = [
  { label: 'Open overview', icon: LayoutDashboard, href: '/admin/dashboard', mode: 'admin', tab: 'overview' },
  { label: 'Review applications', icon: ClipboardList, href: '/admin/dashboard', mode: 'admin', tab: 'applications' },
  { label: 'Maintenance queue', icon: Wrench, href: '/admin/dashboard', mode: 'admin', tab: 'maintenance' },
  { label: 'Manage rooms', icon: Building2, href: '/admin/dashboard', mode: 'admin', tab: 'rooms' },
  { label: 'Students list', icon: UsersRound, href: '/admin/dashboard', mode: 'admin', tab: 'students' },
  { label: 'System settings', icon: Settings, href: '/admin/dashboard', mode: 'admin', tab: 'settings' },
  { label: 'Email templates', icon: Mail, href: '/admin/dashboard', mode: 'admin', tab: 'templates' },
  { label: 'Audit logs', icon: History, href: '/admin/dashboard', mode: 'admin', tab: 'audit' },
];

const managerNavigationActions: GuideAction[] = [
  { label: 'Manager dashboard', icon: LayoutDashboard, href: '/manager/dashboard', mode: 'manager' },
  { label: 'Applications report', icon: ClipboardList, href: '/manager/dashboard', mode: 'manager' },
  { label: 'Maintenance report', icon: Wrench, href: '/manager/dashboard', mode: 'manager' },
  { label: 'Security operations', icon: ShieldCheck, href: '/manager/dashboard', mode: 'manager' },
  { label: 'Student records', icon: UsersRound, href: '/manager/dashboard', mode: 'manager' },
];

const securityNavigationActions: GuideAction[] = [
  { label: 'Security dashboard', icon: ShieldCheck, href: '/security/dashboard', mode: 'security' },
  { label: 'Visitor check-in', icon: UserPlus, href: '/security/dashboard', mode: 'security' },
  { label: 'Active visitors', icon: UsersRound, href: '/security/dashboard', mode: 'security' },
  { label: 'Incident reporting', icon: ClipboardList, href: '/security/dashboard', mode: 'security' },
  { label: 'Room visibility', icon: Building2, href: '/security/dashboard', mode: 'security' },
];

const technicianNavigationActions: GuideAction[] = [
  { label: 'Technician dashboard', icon: Wrench, href: '/technician/dashboard', mode: 'technician' },
  { label: 'Maintenance queue', icon: ClipboardList, href: '/technician/dashboard', mode: 'technician' },
  { label: 'High priority cases', icon: ShieldCheck, href: '/technician/dashboard', mode: 'technician' },
  { label: 'Room maintenance', icon: Building2, href: '/technician/dashboard', mode: 'technician' },
];

const publicNavigationActions: GuideAction[] = [
  { label: 'Explore residences', icon: Building2, href: '/residences' },
  { label: 'Create student account', icon: UserPlus, href: '/register' },
  { label: 'Student login', icon: GraduationCap, href: '/login?portal=student' },
  { label: 'Staff login', icon: ShieldCheck, href: '/login?portal=admin' },
  { label: 'First administrator', icon: KeyRound, href: '/login?portal=admin&bootstrap=1' },
];

const guideModeOptions: Array<{ mode: DashboardMode; label: string; icon: LucideIcon }> = [
  { mode: 'student', label: 'Student', icon: GraduationCap },
  { mode: 'admin', label: 'Admin', icon: ShieldCheck },
  { mode: 'manager', label: 'Manager', icon: LayoutDashboard },
  { mode: 'security', label: 'Security', icon: ShieldCheck },
  { mode: 'technician', label: 'Tech', icon: Wrench },
];

const guideTopics: Record<GuideMode, GuideAction[]> = {
  public: [
    { label: 'Student path', icon: GraduationCap, prompt: 'student walkthrough' },
    { label: 'Staff path', icon: ShieldCheck, prompt: 'staff walkthrough' },
    { label: 'Sign in help', icon: LogIn, prompt: 'login help' },
  ],
  student: [
    { label: 'Student walkthrough', icon: GraduationCap, prompt: 'student walkthrough' },
    { label: 'Documents needed', icon: FileUp, prompt: 'documents' },
    { label: 'Application status', icon: ClipboardList, prompt: 'application status' },
    { label: 'Maintenance help', icon: Wrench, prompt: 'maintenance' },
  ],
  admin: [
    { label: 'Admin walkthrough', icon: ShieldCheck, prompt: 'administrator walkthrough' },
    { label: 'Application review', icon: ClipboardList, prompt: 'review applications' },
    { label: 'Room setup', icon: Building2, prompt: 'rooms' },
    { label: 'Maintenance flow', icon: Wrench, prompt: 'maintenance' },
  ],
  manager: [
    { label: 'Manager walkthrough', icon: LayoutDashboard, prompt: 'manager walkthrough' },
    { label: 'Applications', icon: ClipboardList, prompt: 'review applications' },
    { label: 'Security reports', icon: ShieldCheck, prompt: 'security operations' },
    { label: 'Maintenance', icon: Wrench, prompt: 'maintenance' },
  ],
  security: [
    { label: 'Security walkthrough', icon: ShieldCheck, prompt: 'security walkthrough' },
    { label: 'Visitor check-in', icon: UserPlus, prompt: 'visitor check in' },
    { label: 'Incidents', icon: ClipboardList, prompt: 'incident reporting' },
    { label: 'Rooms', icon: Building2, prompt: 'rooms' },
  ],
  technician: [
    { label: 'Technician walkthrough', icon: Wrench, prompt: 'technician walkthrough' },
    { label: 'Maintenance queue', icon: ClipboardList, prompt: 'maintenance' },
    { label: 'Resolution notes', icon: FileUp, prompt: 'resolution notes' },
    { label: 'Room status', icon: Building2, prompt: 'rooms' },
  ],
};

const roleLabels: Record<GuideMode, string> = {
  public: 'Welcome',
  student: 'Student guide',
  admin: 'Administrator guide',
  manager: 'Manager guide',
  security: 'Security guide',
  technician: 'Technician guide',
};

export function SystemGuideChatbot() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [sessionRoles, setSessionRoles] = useState<string[]>([]);
  const detectedMode = useMemo(() => getDetectedMode(pathname, sessionRoles), [pathname, sessionRoles]);
  const [guideMode, setGuideMode] = useState<GuideMode>(detectedMode);
  const [messages, setMessages] = useState<GuideMessage[]>(() => [createWelcomeMessage(detectedMode)]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncSession = () => setSessionRoles(getSession()?.user.roles ?? []);
    syncSession();
    window.addEventListener('focus', syncSession);
    window.addEventListener('storage', syncSession);
    return () => {
      window.removeEventListener('focus', syncSession);
      window.removeEventListener('storage', syncSession);
    };
  }, [pathname]);

  useEffect(() => {
    setGuideMode(detectedMode);
  }, [detectedMode]);

  useEffect(() => {
    setMessages([createWelcomeMessage(guideMode)]);
  }, [guideMode]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, open]);

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    askGuide(question);
  }

  function askGuide(rawQuestion: string, visibleQuestion = rawQuestion) {
    const trimmed = rawQuestion.trim();
    if (!trimmed) return;
    const reply = getGuideReply(trimmed, guideMode);
    setQuestion('');
    setMessages((current) => [
      ...current,
      createUserMessage(visibleQuestion.trim()),
      createAssistantMessage(reply.text, reply.actions),
    ]);
  }

  function handleAction(action: GuideAction) {
    if (action.prompt) {
      askGuide(action.prompt, action.label);
      return;
    }
    if (!action.href) return;

    if (action.href.startsWith('/login?') && pathname === '/login') {
      const targetUrl = new URL(action.href, window.location.origin);
      const portal = targetUrl.searchParams.get('portal');
      const bootstrap = targetUrl.searchParams.get('bootstrap') === '1';
      window.history.pushState(null, '', action.href);
      if (portal === 'student' || portal === 'admin') {
        window.dispatchEvent(
          new CustomEvent<LoginPortalEventDetail>('josum:open-login-portal', {
            detail: { portal, bootstrap },
          }),
        );
      }
    } else if (action.tab && action.mode && pathname === action.href) {
      const target = `${action.href}?tab=${encodeURIComponent(action.tab)}`;
      window.history.pushState(null, '', target);
      window.dispatchEvent(
        new CustomEvent<DashboardTabEventDetail>('josum:set-dashboard-tab', {
          detail: { mode: action.mode, tab: action.tab },
        }),
      );
    } else {
      router.push(action.href);
    }

    setMessages((current) => [
      ...current,
      createAssistantMessage(`Opening ${action.label.toLowerCase()} now.`),
    ]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="focus-ring fixed bottom-3 right-3 z-[60] grid h-28 w-28 place-items-center rounded-full bg-transparent p-0 transition hover:-translate-y-1 sm:bottom-5 sm:right-5 sm:h-32 sm:w-32"
        aria-label="Open system guide"
        title="Open system guide"
      >
        <ChatbotIcon />
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="System guide"
      className="fixed inset-x-3 bottom-3 z-[60] flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-lg border border-line bg-white shadow-2xl sm:left-auto sm:right-4 sm:w-[28rem]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-line p-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-slate-50 shadow-soft">
            <ChatbotIcon compact />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-ink">System guide</h2>
            <p className="truncate text-xs text-slate-500">{roleLabels[guideMode]} - {BRAND_NAME}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-slate-600 hover:bg-slate-50"
          aria-label="Close system guide"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="border-b border-line p-2">
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 sm:grid-cols-5">
          {guideModeOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setGuideMode(option.mode)}
                className={clsx(
                  'focus-ring inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-semibold',
                  guideMode === option.mode ? 'bg-white text-ink shadow-sm' : 'text-slate-600 hover:bg-white/70',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid min-h-72 gap-3 overflow-y-auto bg-slate-50 p-3 sm:max-h-[28rem]" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={clsx('grid gap-2', message.role === 'user' ? 'justify-items-end' : 'justify-items-start')}>
            <div
              className={clsx(
                'max-w-[88%] whitespace-pre-line rounded-lg px-3 py-2 text-sm leading-6 shadow-sm',
                message.role === 'user' ? 'bg-brand text-white' : 'border border-line bg-white text-ink',
              )}
            >
              {message.text}
            </div>
            {message.actions && message.actions.length > 0 && (
              <div className="flex max-w-[88%] flex-wrap gap-2">
                {message.actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={`${message.id}-${action.label}`}
                      type="button"
                      onClick={() => handleAction(action)}
                      className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-brand" />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="border-t border-line bg-white p-3">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {guideTopics[guideMode].map((topic) => {
            const Icon = topic.icon;
            return (
              <button
                key={topic.label}
                type="button"
                onClick={() => handleAction(topic)}
                className="focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Icon className="h-3.5 w-3.5 text-brand" />
                {topic.label}
              </button>
            );
          })}
        </div>
        <form onSubmit={submitQuestion} className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about applications, documents, rooms..."
            className="focus-ring h-11 min-w-0 rounded-lg border border-line px-3 text-sm"
          />
          <button
            type="submit"
            className="focus-ring grid h-11 w-11 place-items-center rounded-lg bg-brand text-white hover:bg-teal-700"
            aria-label="Send question"
            title="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </section>
  );
}

function getDetectedMode(pathname: string | null, roles: string[]): GuideMode {
  if (pathname?.startsWith('/admin')) return 'admin';
  if (pathname?.startsWith('/manager')) return 'manager';
  if (pathname?.startsWith('/security')) return 'security';
  if (pathname?.startsWith('/technician')) return 'technician';
  if (pathname?.startsWith('/student')) return 'student';
  if (roles.includes('ADMINISTRATOR')) return 'admin';
  if (roles.includes('MANAGER')) return 'manager';
  if (roles.includes('SECURITY')) return 'security';
  if (roles.includes('TECHNICIAN')) return 'technician';
  if (roles.includes('STUDENT')) return 'student';
  return 'public';
}

function createWelcomeMessage(mode: GuideMode): GuideMessage {
  if (mode === 'student') {
    return createAssistantMessage(
      'Hi, I can walk you through the student portal. Start with your profile, then apply for a room, upload supporting documents, and keep an eye on your status.',
      [
        { label: 'Student walkthrough', icon: GraduationCap, prompt: 'student walkthrough' },
        ...studentNavigationActions.slice(1),
      ],
    );
  }

  if (mode === 'admin') {
    return createAssistantMessage(
      'Hi, I can guide administrators through applications, rooms, maintenance oversight, students, settings, templates, and audit logs.',
      [
        { label: 'Admin walkthrough', icon: ShieldCheck, prompt: 'administrator walkthrough' },
        ...adminNavigationActions.slice(1, 5),
      ],
    );
  }

  if (mode === 'manager') {
    return createAssistantMessage(
      'Hi, I can guide managers through applications, occupancy, maintenance oversight, student records, visitors, and security incidents.',
      [
        { label: 'Manager walkthrough', icon: LayoutDashboard, prompt: 'manager walkthrough' },
        ...managerNavigationActions.slice(1),
      ],
    );
  }

  if (mode === 'security') {
    return createAssistantMessage(
      'Hi, I can guide security through visitor check-in, active visitor checkout, incident capture, and room visibility.',
      [
        { label: 'Security walkthrough', icon: ShieldCheck, prompt: 'security walkthrough' },
        ...securityNavigationActions.slice(1),
      ],
    );
  }

  if (mode === 'technician') {
    return createAssistantMessage(
      'Hi, I can guide technicians through maintenance tickets, priority cases, resolution notes, and rooms marked for maintenance.',
      [
        { label: 'Technician walkthrough', icon: Wrench, prompt: 'technician walkthrough' },
        ...technicianNavigationActions.slice(1),
      ],
    );
  }

  return createAssistantMessage(
    'Hi, I can help new students and staff find their way around the system. Choose a path or ask me where to start.',
    [
      { label: 'Student path', icon: GraduationCap, prompt: 'student walkthrough' },
      { label: 'Staff path', icon: ShieldCheck, prompt: 'staff walkthrough' },
      ...publicNavigationActions.slice(0, 3),
    ],
  );
}

function createUserMessage(text: string): GuideMessage {
  return { id: createMessageId(), role: 'user', text };
}

function createAssistantMessage(text: string, actions?: GuideAction[]): GuideMessage {
  return { id: createMessageId(), role: 'assistant', text, actions };
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getGuideReply(rawQuestion: string, mode: GuideMode): Pick<GuideMessage, 'text' | 'actions'> {
  const question = normalize(rawQuestion);

  if (mode === 'public') {
    if (matches(question, ['manager'])) return getManagerTourReply();
    if (matches(question, ['security', 'visitor', 'incident'])) return getSecurityTourReply();
    if (matches(question, ['technician', 'maintenance'])) return getTechnicianTourReply();
    if (matches(question, ['admin', 'administrator', 'manage', 'staff', 'bootstrap'])) return getStaffTourReply();
    if (matches(question, ['document', 'upload', 'passport', 'acceptance', 'guarantor', 'photo'])) return getStudentReply(question);
    if (matches(question, ['application', 'booking', 'status', 'profile', 'maintenance', 'complaint'])) return getStudentReply(question);
    if (matches(question, ['student', 'register', 'apply', 'accommodation', 'room'])) return getStudentTourReply();
    if (matches(question, ['login', 'sign in', 'password', 'account'])) {
      return {
        text: 'Students can create an account or sign in from the student login. Staff use Staff Login; managers, security, and technicians can register with their role key, while the first administrator uses the bootstrap token.',
        actions: publicNavigationActions,
      };
    }
    return {
      text: 'Pick the student path if you are applying for accommodation. Pick the staff path if you need administration, management reports, security visitor control, or maintenance workflows.',
      actions: [
        { label: 'Student path', icon: GraduationCap, prompt: 'student walkthrough' },
        { label: 'Staff path', icon: ShieldCheck, prompt: 'staff walkthrough' },
        ...publicNavigationActions,
      ],
    };
  }

  if (matches(question, ['student walkthrough', 'student path', 'new student', 'start', 'tour'])) return getStudentTourReply();
  if (matches(question, ['staff walkthrough', 'staff path', 'staff tour'])) return getStaffTourReply();
  if (matches(question, ['admin walkthrough', 'admin path', 'administrator', 'admin tour'])) return getAdminTourReply();
  if (matches(question, ['manager walkthrough', 'manager path', 'manager tour'])) return getManagerTourReply();
  if (matches(question, ['security walkthrough', 'security path', 'security tour'])) return getSecurityTourReply();
  if (matches(question, ['technician walkthrough', 'technician path', 'technician tour'])) return getTechnicianTourReply();

  if (mode === 'student') return getStudentReply(question);
  return getStaffReply(question, mode);
}

function getStudentReply(question: string): Pick<GuideMessage, 'text' | 'actions'> {
  if (matches(question, ['document', 'upload', 'id', 'passport', 'acceptance', 'guarantor', 'photo'])) {
    return {
      text: 'Use the Documents tab after you submit an application. Upload the applicant ID or passport, two student color ID photos, the student acceptance letter, guarantor supporting documents, and any medical aid certificate requested for international students.',
      actions: [
        studentNavigationActions[2],
        studentNavigationActions[1],
      ],
    };
  }

  if (matches(question, ['apply', 'application', 'booking', 'room', 'accommodation', 'rates', 'fee'])) {
    return {
      text: 'Go to Apply and complete the eligibility, study year, semester, residence, student, funding, medical, and guardian sections. Returning students can choose an available numbered room. Review the terms, draw your signature, and submit.',
      actions: [
        studentNavigationActions[1],
        studentNavigationActions[2],
        studentNavigationActions[0],
      ],
    };
  }

  if (matches(question, ['status', 'approved', 'pending', 'rejected', 'history', 'notification'])) {
    return {
      text: 'Your Overview tab shows applications, active status, submitted documents, unread notices, and status history. Refreshes happen automatically while you are signed in.',
      actions: [
        studentNavigationActions[0],
        studentNavigationActions[2],
      ],
    };
  }

  if (matches(question, ['maintenance', 'complaint', 'repair', 'issue', 'broken', 'fix'])) {
    return {
      text: 'Use Maintenance to report a residence issue. Add a clear title, category, priority, room type if relevant, location, and description. The admin team can acknowledge, move it in progress, and resolve it.',
      actions: [studentNavigationActions[3]],
    };
  }

  if (matches(question, ['profile', 'details', 'phone', 'address', 'student number', 'course', 'institution'])) {
    return {
      text: 'Use Profile to keep your personal, institution, course, emergency contact, ID number, and address details current before applying or following up.',
      actions: [studentNavigationActions[4]],
    };
  }

  if (matches(question, ['login', 'password', 'sign in', 'register'])) {
    return {
      text: 'Students can register, sign in, or reset a forgotten password from the public pages. After sign-in you land on the student dashboard.',
      actions: publicNavigationActions.slice(0, 2),
    };
  }

  return {
    text: 'For students, the main flow is Profile, Apply, Documents, Overview, then Maintenance when something needs attention.',
    actions: studentNavigationActions,
  };
}

function getStaffReply(question: string, mode: StaffGuideMode): Pick<GuideMessage, 'text' | 'actions'> {
  if (mode === 'security') {
    if (matches(question, ['visitor', 'check in', 'checkout', 'check out', 'active visitors'])) {
      return {
        text: 'Use the Security Dashboard to check visitors in, view everyone currently on site, and check visitors out once they leave.',
        actions: securityNavigationActions.slice(0, 3),
      };
    }
    if (matches(question, ['incident', 'report', 'severity', 'safety'])) {
      return {
        text: 'Use Incident Reporting to capture the title, category, severity, residence, location, and description. Managers and administrators can review and close those records.',
        actions: [securityNavigationActions[3], securityNavigationActions[0]],
      };
    }
    if (matches(question, ['room', 'rooms', 'visibility', 'maintenance'])) {
      return {
        text: 'Use Room Visibility to check room status while handling access, visitor, or incident questions.',
        actions: [securityNavigationActions[4]],
      };
    }
    return {
      text: 'Security users focus on visitor check-in, active visitor checkout, incident capture, and room visibility.',
      actions: securityNavigationActions,
    };
  }

  if (mode === 'technician') {
    if (matches(question, ['maintenance', 'ticket', 'queue', 'acknowledge', 'repair', 'issue', 'broken'])) {
      return {
        text: 'Use the Maintenance Queue to review reported issues, update the workflow status, and keep resolution notes clear for the resident and management team.',
        actions: technicianNavigationActions.slice(0, 3),
      };
    }
    if (matches(question, ['resolution', 'resolved', 'closed', 'note'])) {
      return {
        text: 'Before marking a maintenance item resolved or closed, add a resolution note that explains what changed or what still needs follow-up.',
        actions: [technicianNavigationActions[1]],
      };
    }
    if (matches(question, ['room', 'rooms', 'maintenance'])) {
      return {
        text: 'Rooms marked for maintenance appear beside the queue so technicians can quickly see where attention is needed.',
        actions: [technicianNavigationActions[3]],
      };
    }
    return {
      text: 'Technicians focus on maintenance tickets, priority cases, resolution notes, and rooms marked for maintenance.',
      actions: technicianNavigationActions,
    };
  }

  if (mode === 'manager') {
    if (matches(question, ['security', 'visitor', 'incident'])) {
      return {
        text: 'Managers can monitor security operations from the Manager Dashboard, including recent visitors and incident status.',
        actions: [managerNavigationActions[3], managerNavigationActions[0]],
      };
    }
    if (matches(question, ['student', 'students', 'records', 'profile'])) {
      return {
        text: 'Managers can view authorised student records and profile-photo completion without opening administrator-only settings.',
        actions: [managerNavigationActions[4]],
      };
    }
  }

  if (matches(question, ['application', 'review', 'approve', 'reject', 'waitlist', 'status', 'documents'])) {
    if (mode !== 'admin' && mode !== 'manager') {
      return {
        text: 'Application review is limited to administrators and managers. Your dashboard keeps you on the records and actions assigned to your staff role.',
        actions: getActionsForStaffMode(mode),
      };
    }
    return {
      text: mode === 'admin'
        ? 'Use Applications to filter by Josum 1 or Josum 2, open a reference, review the selected residence and student documents, update the status, add a note, and save internal admin notes.'
        : 'Use the Manager Dashboard to review application status, document completeness, occupancy, and student-facing notes.',
      actions: [
        ...(mode === 'manager' ? [managerNavigationActions[1], managerNavigationActions[0]] : [adminNavigationActions[1], adminNavigationActions[0]]),
      ],
    };
  }

  if (matches(question, ['room', 'rooms', 'availability', 'total', 'passcode', 'single', 'sharing'])) {
    return {
      text: mode === 'admin'
        ? 'Use Rooms to manage every numbered room at Josum 1 and Josum 2 as Available, Reserved, Occupied, or Maintenance. Assign an available gender-compatible room before approving an application.'
        : 'Use the Manager Dashboard to monitor room availability and residence occupancy across Josum 1 and Josum 2.',
      actions: mode === 'manager' ? [managerNavigationActions[0]] : [adminNavigationActions[3]],
    };
  }

  if (matches(question, ['maintenance', 'complaint', 'repair', 'acknowledge', 'resolved', 'in progress'])) {
    return {
      text: mode === 'manager'
        ? 'Managers can oversee the maintenance workflow, update status, and make sure resolution notes are captured.'
        : 'Use Maintenance to move each complaint through Acknowledged, In progress, and Resolved. Add a resolution note so students can see what changed.',
      actions: mode === 'manager' ? [managerNavigationActions[2]] : [adminNavigationActions[2]],
    };
  }

  if (matches(question, ['student', 'students', 'status', 'active', 'blocked'])) {
    if (mode !== 'admin' && mode !== 'manager') {
      return {
        text: 'Student record management is limited to administrators and managers. Your dashboard shows the student or room context needed for your assigned workflow.',
        actions: getActionsForStaffMode(mode),
      };
    }
    return {
      text: mode === 'manager'
        ? 'Managers can view authorised student records and profile-photo completion from the Manager Dashboard.'
        : 'Use Students to review student records and update their account status. This helps keep access aligned with current residents and applicants.',
      actions: mode === 'manager' ? [managerNavigationActions[4]] : [adminNavigationActions[4]],
    };
  }

  if (matches(question, ['email', 'template', 'notification', 'message'])) {
    if (mode !== 'admin') {
      return {
        text: 'Email templates and system-wide messaging are administrator controls. Your dashboard keeps you focused on the actions available to your role.',
        actions: getActionsForStaffMode(mode),
      };
    }
    return {
      text: 'Use Email templates to update the messages sent during application and maintenance workflows. Keep subjects clear and use the template body for the full notice.',
      actions: [adminNavigationActions[6]],
    };
  }

  if (matches(question, ['setting', 'settings', 'factory', 'reset', 'system'])) {
    if (mode !== 'admin') {
      return {
        text: 'System settings are administrator-only. Managers, security officers, and technicians have their own dashboards without configuration controls.',
        actions: getActionsForStaffMode(mode),
      };
    }
    return {
      text: 'Use Settings for system-level values. The factory reset control is intentionally guarded, so only run it when you are ready to clear operational data and return to the initial state.',
      actions: [adminNavigationActions[5]],
    };
  }

  if (matches(question, ['audit', 'history', 'log', 'logs'])) {
    if (mode !== 'admin') {
      return {
        text: 'Audit logs are administrator-only in this portal. Operational history relevant to your role appears inside your dashboard records.',
        actions: getActionsForStaffMode(mode),
      };
    }
    return {
      text: 'Use Audit logs to check who changed system records and when. It is the quickest place to verify important admin actions.',
      actions: [adminNavigationActions[7]],
    };
  }

  return {
    text: 'For staff, the dashboard depends on the role: managers see operations and reviews, security sees visitors and incidents, technicians see maintenance, and administrators also see settings and audit logs.',
    actions: getActionsForStaffMode(mode),
  };
}

function getStudentTourReply(): Pick<GuideMessage, 'text' | 'actions'> {
  return {
    text: 'Student path:\n1. Explore Josum 1 and Josum 2, then create an account or sign in.\n2. Check Profile and complete missing details.\n3. Open Apply, select a residence, review the rates and terms, then submit the form.\n4. Upload required documents.\n5. Track status from Overview and use Maintenance for residence issues.',
    actions: [
      ...publicNavigationActions.slice(0, 2),
      studentNavigationActions[4],
      studentNavigationActions[1],
      studentNavigationActions[2],
      studentNavigationActions[0],
    ],
  };
}

function getStaffTourReply(): Pick<GuideMessage, 'text' | 'actions'> {
  return {
    text: 'Staff path:\n1. Sign in from Staff Login.\n2. Managers use the Manager Dashboard for reports, applications, occupancy, students, maintenance, visitors, and incidents.\n3. Security uses the Security Dashboard for visitor check-in, active visitors, incidents, and room visibility.\n4. Technicians use the Technician Dashboard for maintenance queues and resolution notes.\n5. Administrators use the Admin Dashboard for settings, templates, audit logs, and full oversight.',
    actions: [
      ...publicNavigationActions.slice(2),
      managerNavigationActions[0],
      securityNavigationActions[0],
      technicianNavigationActions[0],
      adminNavigationActions[0],
    ],
  };
}

function getAdminTourReply(): Pick<GuideMessage, 'text' | 'actions'> {
  return {
    text: 'Administrator path:\n1. Sign in from Staff Login.\n2. Open the Admin Dashboard for applications, rooms, maintenance oversight, student records, templates, settings, and audit logs.\n3. Use the separate staff dashboards when testing Manager, Security, or Technician access.',
    actions: [
      ...publicNavigationActions.slice(2),
      adminNavigationActions[0],
      adminNavigationActions[1],
      adminNavigationActions[3],
      adminNavigationActions[2],
    ],
  };
}

function getManagerTourReply(): Pick<GuideMessage, 'text' | 'actions'> {
  return {
    text: 'Manager path:\n1. Sign in from Staff Login with a Manager account.\n2. Review applications, document completeness, room occupancy, student records, maintenance, visitors, and incidents.\n3. Managers get oversight and reports without administrator-only settings or factory reset controls.',
    actions: [
      publicNavigationActions[3],
      ...managerNavigationActions,
    ],
  };
}

function getSecurityTourReply(): Pick<GuideMessage, 'text' | 'actions'> {
  return {
    text: 'Security path:\n1. Sign in from Staff Login with a Security account.\n2. Use the Security Dashboard to check visitors in, monitor active visitors, check visitors out, capture incidents, and view room status.\n3. Security does not receive application approval, finance, or maintenance administration controls.',
    actions: [
      publicNavigationActions[3],
      ...securityNavigationActions,
    ],
  };
}

function getTechnicianTourReply(): Pick<GuideMessage, 'text' | 'actions'> {
  return {
    text: 'Technician path:\n1. Sign in from Staff Login with a Technician account.\n2. Use the Technician Dashboard to review maintenance tickets, focus on high-priority cases, update statuses, and add resolution notes.\n3. Technicians do not receive application approval, finance, or system configuration controls.',
    actions: [
      publicNavigationActions[3],
      ...technicianNavigationActions,
    ],
  };
}

function getActionsForStaffMode(mode: StaffGuideMode) {
  if (mode === 'manager') return managerNavigationActions;
  if (mode === 'security') return securityNavigationActions;
  if (mode === 'technician') return technicianNavigationActions;
  return adminNavigationActions;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matches(question: string, terms: string[]) {
  return terms.some((term) => question.includes(term));
}

function ChatbotIcon({ compact = false }: { compact?: boolean }) {
  return <div aria-hidden="true" className={clsx('robot-avatar', compact ? 'robot-avatar--compact' : 'robot-avatar--launcher')} />;
}
