import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/components/ToastProvider';
import { SystemGuideChatbot } from '@/components/SystemGuideChatbot';

export const metadata: Metadata = {
  title: {
    default: 'Josum Student Accommodation',
    template: '%s | Josum Student Accommodation',
  },
  description: 'Multi-residence student accommodation booking and administration portal in Bedworth Park, Vereeniging.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
          <SystemGuideChatbot />
        </ToastProvider>
      </body>
    </html>
  );
}
