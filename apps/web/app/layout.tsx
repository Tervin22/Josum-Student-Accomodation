import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import { SystemGuideChatbot } from '@/components/SystemGuideChatbot';

export const metadata: Metadata = {
  title: {
    default: 'Botlogile, Mohunathagi and Roma Residences',
    template: '%s | Student Residence Portal',
  },
  description: 'Multi-residence student accommodation booking and administration portal in Bedworth Park, Vereeniging.',
  robots: process.env.NEXT_PUBLIC_CLIENT_PREVIEW_MODE === 'true' ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {process.env.NEXT_PUBLIC_CLIENT_PREVIEW_MODE === 'true' && (
          <aside role="note" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
            Client testing environment. Use sample information only. Emails are disabled and uploaded files may clear after a restart.
          </aside>
        )}
        <ToastProvider>
          {children}
          <SystemGuideChatbot />
        </ToastProvider>
      </body>
    </html>
  );
}
